import { browser } from "wxt/browser";
import type {
    ApiLookupReason,
    ApiLookupResult,
    ApiSegment,
    SubmitResult,
    SubmitSegmentsParams,
} from "@/types/types";
import { readCachedSegments, writeCachedSegments } from "@/utils/segmentCache";

/**
 * BilibiliSponsorBlock 接口。
 * 文档：https://github.com/hanydd/BilibiliSponsorBlock/wiki/API
 * - GET /api/skipSegments?videoID=BV...&cid=...（cid 省略时返回该 BV 全部分P）
 * - 无数据返回 404；参数错误 400；限流 429
 */
export const SB_API_URL = "https://bsbsb.top/api/skipSegments";

const REQUEST_TIMEOUT_MS = 3000;
const SUBMIT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000;

const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

/** 内存中的在途请求去重：同一视频并发只打一次接口 */
const inFlight = new Map<string, Promise<ApiLookupResult>>();

export const isValidBvid = (bvid?: string): bvid is string =>
    typeof bvid === "string" && BVID_PATTERN.test(bvid);

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

/**
 * 兼容两种返回结构：
 * 1. 扁平片段数组：[{ segment: [start, end], UUID, category, ... }]
 * 2. 按视频分组：[{ videoID, segments: [ ... ] }]
 * 同时丢弃时间非法（NaN / end <= start）的脏数据。
 */
export function normalizeSegments(raw: unknown): ApiSegment[] {
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
): Promise<ApiSegment[]> {
    let response: Response;

    try {
        response = await fetch(buildSegmentsUrl(bvid, cid), {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            // Origin 由浏览器自动携带，脚本无法设置；这里只标识扩展版本
            headers: {
                "x-ext-version": browser.runtime.getManifest().version,
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
        return normalizeSegments(await response.json());
    } catch {
        throw new ApiRequestError("bad-json");
    }
}

/**
 * 查询某个视频的云端片段（带缓存与并发去重）。
 *
 * @param bvid 视频 BV 号
 * @param cid  可选，分P 的 cid；省略时返回该 BV 全部分P 的片段
 */
export async function getSkipSegments(
    bvid?: string,
    cid?: string,
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

    const cached = await readCachedSegments(key);
    if (cached) {
        return { ok: true, segments: cached, fromCache: true };
    }

    const running = inFlight.get(key);
    if (running) return running;

    const task = (async (): Promise<ApiLookupResult> => {
        try {
            const segments = await requestSkipSegments(bvid, cid);
            await writeCachedSegments(key, segments, CACHE_TTL_MS);
            return { ok: true, segments, fromCache: false };
        } catch (error) {
            const reason: ApiLookupReason =
                error instanceof ApiRequestError ? error.reason : "network";

            if (reason === "not-found") {
                // 无数据是常态：短暂缓存空结果，避免反复请求
                await writeCachedSegments(key, [], NEGATIVE_CACHE_TTL_MS);
                return {
                    ok: true,
                    segments: [],
                    fromCache: false,
                    reason,
                };
            }

            return { ok: false, segments: [], fromCache: false, reason };
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, task);
    return task;
}

/**
 * 提交片段到 bsbsb.top（POST /api/skipSegments）。
 * 需要调用方提供私人 userID；视频时长用于服务端判断是否换源。
 */
export async function submitSkipSegments(
    params: SubmitSegmentsParams,
): Promise<SubmitResult> {
    if (!isValidBvid(params.bvid)) {
        return { ok: false, reason: "bad-bvid" };
    }

    if (!params.userID || params.segments.length === 0) {
        return { ok: false, reason: "bad-request" };
    }

    const payload = {
        videoID: params.bvid,
        cid: params.cid,
        userID: params.userID,
        userAgent: navigator.userAgent,
        videoDuration: params.videoDuration,
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
                "x-ext-version": browser.runtime.getManifest().version,
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

    if (response.status === 400) return { ok: false, reason: "bad-request" };
    if (response.status === 403) return { ok: false, reason: "rejected" };
    if (response.status === 409) return { ok: false, reason: "duplicate" };
    if (response.status === 429) return { ok: false, reason: "rate-limited" };
    if (!response.ok) {
        return { ok: false, reason: `http-${response.status}` };
    }

    let created: unknown;
    try {
        created = await response.json();
    } catch {
        created = undefined;
    }

    return { ok: true, created };
}
