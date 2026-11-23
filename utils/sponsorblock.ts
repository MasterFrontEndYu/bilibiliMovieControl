import { browser } from "wxt/browser";
import type {
    ApiLookupReason,
    ApiLookupResult,
    ApiSegment,
    ApiSegmentInfo,
    BiliVideoPage,
    BiliVideoPageInfo,
    SegmentInfoResult,
    SubmitResult,
    SubmitSegmentsParams,
    VoteResult,
    VoteType,
} from "@/types/types";
import { isValidBvid } from "@/utils/bilibili";
import { readCachedSegments, writeCachedSegments } from "@/utils/segmentCache";

export { isValidBvid };

/**
 * BilibiliSponsorBlock 接口。
 * 文档：https://github.com/hanydd/BilibiliSponsorBlock/wiki/API
 * - GET /api/skipSegments?videoID=BV...&cid=...（cid 省略时返回该 BV 全部分P）
 * - 无数据返回 404；参数错误 400；限流 429
 *
 * 官方提供正式 / 测试两套环境：
 * - 正式：https://bsbsb.top/api/**
 * - 测试：https://bsbsb.top/test/api/**
 */
export const SB_API_BASE_PRODUCTION = "https://bsbsb.top/api";
export const SB_API_BASE_TEST = "https://bsbsb.top/test/api";

/**
 * 默认使用正式环境。
 * 需要查询测试环境时，在启动前设置环境变量 `VITE_SB_API=test`。
 * 注意：测试环境只提供查询，上传（POST）会返回 405。
 */
export const SB_API_IS_TEST = import.meta.env.VITE_SB_API === "test";

export const SB_API_BASE = SB_API_IS_TEST
    ? SB_API_BASE_TEST
    : SB_API_BASE_PRODUCTION;

export const SB_API_URL = `${SB_API_BASE}/skipSegments`;
export const SB_SEGMENT_INFO_URL = `${SB_API_BASE}/segmentInfo`;
export const SB_VOTE_URL = `${SB_API_BASE}/voteOnSponsorTime`;

const REQUEST_TIMEOUT_MS = 8000;
const SUBMIT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const FORCE_CACHE_TTL_MS = 2 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000;

/** 内存中的在途请求去重：同一视频并发只打一次接口 */
const inFlight = new Map<string, Promise<ApiLookupResult>>();

const cacheKey = (bvid: string, cid?: string) => `${bvid}:${cid ?? "all"}`;

export function buildSegmentsUrl(bvid: string, cid?: string): string {
    const url = new URL(SB_API_URL);
    url.searchParams.set("videoID", bvid);
    if (cid) url.searchParams.set("cid", cid);
    return url.toString();
}

function toNumber(value: unknown, fallback = 0): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** 扩展版本只用于请求头；测试环境没有 browser 时不影响逻辑 */
function extensionVersion(): string {
    try {
        return browser.runtime.getManifest().version;
    } catch {
        return "unknown";
    }
}

/**
 * 兼容两种返回结构：
 * 1. 扁平片段数组：[{ segment: [start, end], UUID, category, ... }]
 * 2. 按视频分组：[{ videoID, segments: [ ... ] }]
 * 同时丢弃时间非法（NaN / end <= start）的脏数据。
 */
export function normalizeApiSegments(raw: unknown): ApiSegment[] {
    const segments: ApiSegment[] = [];
    const visited = new Set<object>();

    const push = (item: any) => {
        if (!item || typeof item !== "object" || visited.has(item)) return;
        visited.add(item);

        const bounds = Array.isArray(item.segment) ? item.segment : [];
        const start = toNumber(bounds[0], Number.NaN);
        const end = toNumber(bounds[1], Number.NaN);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
            return;

        segments.push({
            id: String(item.UUID ?? `${start}-${end}`),
            cid: item.cid == null ? "" : String(item.cid),
            start,
            end,
            category: String(item.category ?? "sponsor"),
            actionType: String(item.actionType ?? "skip"),
            locked: toNumber(item.locked),
            votes: toNumber(item.votes),
            videoDuration: toNumber(item.videoDuration),
        });
    };

    const walk = (value: any) => {
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value.segments)) {
            for (const item of value.segments) push(item);
            return;
        }
        push(value);
    };

    walk(raw);
    return segments.sort((a, b) => a.start - b.start);
}

class ApiRequestError extends Error {
    constructor(readonly reason: ApiLookupReason) {
        super(reason);
        this.name = "ApiRequestError";
    }
}

async function requestSkipSegments(
    bvid: string,
    cid?: string,
    force = false,
): Promise<ApiSegment[]> {
    let response: Response;

    try {
        response = await fetch(buildSegmentsUrl(bvid, cid), {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            // Origin 由浏览器自动携带，脚本无法设置；这里只标识扩展版本
            headers: {
                "x-ext-version": extensionVersion(),
                ...(force ? { "x-skip-cache": "1" } : {}),
            },
        });
    } catch (error) {
        const name = (error as Error | undefined)?.name;
        throw new ApiRequestError(
            name === "TimeoutError" ? "timeout" : "network",
        );
    }

    if (response.status === 404) throw new ApiRequestError("not-found");
    if (response.status === 429) throw new ApiRequestError("rate-limited");
    if (!response.ok) {
        throw new ApiRequestError(`http-${response.status}`);
    }

    try {
        return normalizeApiSegments(await response.json());
    } catch {
        throw new ApiRequestError("bad-json");
    }
}

/**
 * 查询某个视频的云端片段（带缓存与并发去重）。
 *
 * @param bvid  视频 BV 号
 * @param cid   可选，分P 的 cid；省略时返回该 BV 全部分P 的片段
 * @param force 为 true 时跳过本地缓存并带 `x-skip-cache` 请求服务端
 */
export async function getSkipSegments(
    bvid?: string,
    cid?: string,
    force = false,
): Promise<ApiLookupResult> {
    if (!isValidBvid(bvid)) {
        return {
            ok: false,
            segments: [],
            fromCache: false,
            reason: "bad-bvid",
        };
    }

    const key = cacheKey(bvid, cid);

    if (!force) {
        const cached = await readCachedSegments(key);
        if (cached) {
            return { ok: true, segments: cached, fromCache: true };
        }
    }

    const flightKey = `${key}:${force ? "force" : "normal"}`;

    const running = inFlight.get(flightKey);
    if (running) return running;

    const task = (async (): Promise<ApiLookupResult> => {
        try {
            const segments = await requestSkipSegments(bvid, cid, force);
            await writeCachedSegments(
                key,
                segments,
                force ? FORCE_CACHE_TTL_MS : CACHE_TTL_MS,
            );
            return { ok: true, segments, fromCache: false };
        } catch (error) {
            const reason: ApiLookupReason =
                error instanceof ApiRequestError ? error.reason : "network";

            if (reason === "not-found") {
                // 无数据是常态：短暂缓存空结果，避免反复请求；强制刷新时不写
                if (!force) {
                    await writeCachedSegments(key, [], NEGATIVE_CACHE_TTL_MS);
                }
                return {
                    ok: true,
                    segments: [],
                    fromCache: false,
                    reason,
                };
            }

            return { ok: false, segments: [], fromCache: false, reason };
        } finally {
            inFlight.delete(flightKey);
        }
    })();

    inFlight.set(flightKey, task);
    return task;
}

async function readErrorText(response: Response): Promise<string> {
    try {
        const text = (await response.text()).trim();
        return text.slice(0, 300);
    } catch {
        return "";
    }
}

/** 拉取 bilibili pagelist：cid → 分P 号 / 时长 / 标题 */
export async function fetchVideoPages(
    bvid: string,
): Promise<BiliVideoPageInfo[]> {
    try {
        const response = await fetch(
            `https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`,
            { signal: AbortSignal.timeout(3000) },
        );
        if (!response.ok) return [];

        const data = (await response.json()) as {
            data?: Array<{
                page?: number;
                cid?: number | string;
                duration?: number;
                part?: string;
            }>;
        };

        const pages = Array.isArray(data?.data) ? data.data : [];

        return pages
            .filter((item) => item && item.cid != null)
            .map((item) => ({
                page: Number(item.page) || 0,
                cid: String(item.cid),
                duration: Number(item.duration) || 0,
                title: typeof item.part === "string" ? item.part : undefined,
            }));
    } catch {
        return [];
    }
}

/** 用 bilibili pagelist 补齐当前分P 的 cid 和规范时长 */
export async function resolveVideoPage(
    bvid: string,
    page: number,
): Promise<BiliVideoPage | null> {
    const pages = await fetchVideoPages(bvid);
    const info = pages.find((item) => item.page === page);

    // 找不到目标分P 时不要退回第 1 P，否则可能查询/提交到错误的 cid
    return info ? { cid: info.cid, duration: info.duration } : null;
}

function normalizeSegmentInfo(raw: Record<string, unknown>): ApiSegmentInfo {
    const value = (key: string) => raw[key];
    const text = (key: string) => {
        const item = value(key);
        return item == null ? "" : String(item);
    };
    const number = (key: string) => toNumber(value(key));

    return {
        videoID: text("videoID"),
        cid: text("cid"),
        startTime: number("startTime"),
        endTime: number("endTime"),
        votes: number("votes"),
        locked: number("locked"),
        UUID: text("UUID"),
        userID: text("userID"),
        timeSubmitted: number("timeSubmitted"),
        views: number("views"),
        category: text("category"),
        actionType: text("actionType"),
        videoDuration: number("videoDuration"),
        hidden: number("hidden"),
        reputation: number("reputation"),
        shadowHidden: number("shadowHidden"),
        hashedVideoID:
            typeof value("hashedVideoID") === "string"
                ? String(value("hashedVideoID"))
                : undefined,
        userAgent:
            typeof value("userAgent") === "string"
                ? String(value("userAgent"))
                : undefined,
    };
}

/** 查询单个片段的详细信息（GET /api/segmentInfo） */
export async function getSegmentInfo(
    uuid?: string,
    force = false,
): Promise<SegmentInfoResult> {
    if (typeof uuid !== "string" || uuid.length === 0) {
        return { ok: false, reason: "bad-request" };
    }

    const url = new URL(SB_SEGMENT_INFO_URL);
    url.searchParams.set("UUID", uuid);

    let response: Response;
    try {
        response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: {
                "x-ext-version": extensionVersion(),
                ...(force ? { "x-skip-cache": "1" } : {}),
            },
        });
    } catch (error) {
        const name = (error as Error | undefined)?.name;
        return {
            ok: false,
            reason: name === "TimeoutError" ? "timeout" : "network",
        };
    }

    if (response.status === 404) {
        return { ok: false, reason: "not-found" };
    }
    if (response.status === 429) {
        return { ok: false, reason: "rate-limited" };
    }
    if (!response.ok) {
        return {
            ok: false,
            reason: `http-${response.status}`,
            message: await readErrorText(response),
        };
    }

    let data: unknown;
    try {
        data = await response.json();
    } catch {
        return { ok: false, reason: "bad-json" };
    }

    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw || typeof raw !== "object") {
        return { ok: false, reason: "not-found" };
    }

    return {
        ok: true,
        info: normalizeSegmentInfo(raw as Record<string, unknown>),
    };
}

/** 对片段投票（POST /api/voteOnSponsorTime） */
export async function voteOnSegment(
    uuid: string,
    userID: string,
    type: VoteType,
): Promise<VoteResult> {
    if (!uuid || !userID || ![0, 1, 20].includes(type)) {
        return { ok: false, reason: "bad-request" };
    }

    let response: Response;
    try {
        response = await fetch(SB_VOTE_URL, {
            method: "POST",
            signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
            headers: {
                "content-type": "application/json",
                "x-ext-version": extensionVersion(),
            },
            body: JSON.stringify({ UUID: uuid, userID, type }),
        });
    } catch (error) {
        const name = (error as Error | undefined)?.name;
        return {
            ok: false,
            reason: name === "TimeoutError" ? "timeout" : "network",
        };
    }

    if (response.status === 400) {
        return {
            ok: false,
            reason: "bad-request",
            message: await readErrorText(response),
        };
    }
    if (response.status === 403) {
        return {
            ok: false,
            reason: "rejected",
            message: await readErrorText(response),
        };
    }
    if (response.status === 429) {
        return {
            ok: false,
            reason: "rate-limited",
            message: await readErrorText(response),
        };
    }
    if (!response.ok) {
        return {
            ok: false,
            reason: `http-${response.status}`,
            message: await readErrorText(response),
        };
    }

    return { ok: true };
}

/**
 * 提交片段到 bsbsb.top（POST /api/skipSegments）。
 * 需要调用方提供私人 userID；视频时长用于服务端判断是否换源。
 */
export async function submitSkipSegments(
    params: SubmitSegmentsParams,
): Promise<SubmitResult> {
    if (SB_API_IS_TEST) {
        return { ok: false, reason: "test-env" };
    }

    if (!isValidBvid(params.bvid)) {
        return { ok: false, reason: "bad-bvid" };
    }

    if (!params.userID || params.segments.length === 0) {
        return { ok: false, reason: "bad-request" };
    }

    const resolved = await resolveVideoPage(params.bvid, params.page ?? 1);
    const cid = params.cid ?? resolved?.cid;

    if (!cid) {
        return { ok: false, reason: "network" };
    }

    const videoDuration =
        resolved && resolved.duration > 0
            ? resolved.duration
            : params.videoDuration;

    const payload = {
        videoID: params.bvid,
        cid,
        userID: params.userID,
        userAgent: navigator.userAgent,
        videoDuration,
        segments: params.segments.map((segment) => ({
            segment: [segment.start, segment.end],
            category: segment.category ?? "sponsor",
            actionType: segment.actionType ?? "skip",
        })),
    };

    let response: Response;

    try {
        response = await fetch(SB_API_URL, {
            method: "POST",
            signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
            headers: {
                "content-type": "application/json",
                "x-ext-version": extensionVersion(),
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        const name = (error as Error | undefined)?.name;
        return {
            ok: false,
            reason: name === "TimeoutError" ? "timeout" : "network",
        };
    }

    if (response.status === 400) {
        const message = await readErrorText(response);
        console.warn("[SB] 上传失败 400", message);
        return {
            ok: false,
            reason: "bad-request",
            message,
        };
    }
    if (response.status === 403) {
        return {
            ok: false,
            reason: "rejected",
            message: await readErrorText(response),
        };
    }
    if (response.status === 409) {
        return {
            ok: false,
            reason: "duplicate",
            message: await readErrorText(response),
        };
    }
    if (response.status === 429) {
        return {
            ok: false,
            reason: "rate-limited",
            message: await readErrorText(response),
        };
    }
    if (!response.ok) {
        const message = await readErrorText(response);
        console.warn("[SB] 上传失败", response.status, message);
        return {
            ok: false,
            reason: `http-${response.status}`,
            message,
        };
    }

    let created: unknown;
    try {
        created = await response.json();
    } catch {
        created = undefined;
    }

    return { ok: true, created };
}
