import { browser } from "wxt/browser";
import type { SkipSegment, TimePoint } from "@/types/types";

/** BilibiliSponsorBlock 对片段长度的最低要求（秒） */
export const MIN_SEGMENT_SECONDS = 1;

const STORAGE_KEY = "segments";

const toSeconds = (value: unknown): number => {
    if (!value || typeof value !== "object") return Number.NaN;
    const point = value as Partial<TimePoint>;
    return (
        (Number(point.h) || 0) * 3600 +
        (Number(point.m) || 0) * 60 +
        (Number(point.s) || 0)
    );
};

/**
 * 校验并规范化片段列表：
 * - skip 必须有 ≥1 秒的正向长度
 * - next 的 end <= start 视为"到视频结尾"（历史切集点迁移时会出现）
 */
export function normalizeSegments(raw: unknown): SkipSegment[] {
    if (!Array.isArray(raw)) return [];

    const segments: SkipSegment[] = [];

    for (const item of raw) {
        if (!item || typeof item !== "object") continue;

        const record = item as Record<string, unknown>;
        const start = Number(record.start);
        const end = Number(record.end);
        const kind = record.kind === "next" ? "next" : "skip";
        const source = record.source === "api" ? "api" : "manual";

        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0)
            continue;
        if (kind === "skip" && end - start < MIN_SEGMENT_SECONDS) continue;
        if (kind === "next" && end < 0) continue;

        segments.push({
            id: String(record.id ?? crypto.randomUUID()),
            start,
            end,
            kind,
            source,
        });
    }

    return segments.sort((a, b) => {
        // 下一P 永远排在最后
        if (a.kind !== b.kind) return a.kind === "next" ? 1 : -1;
        return a.start - b.start;
    });
}

/** 把旧版 opRanges + jumpConfig 迁移成统一片段列表 */
export function migrateLegacySegments(
    opRanges: unknown,
    jumpConfig: unknown,
): SkipSegment[] {
    const segments: SkipSegment[] = [];

    if (Array.isArray(opRanges)) {
        for (const range of opRanges) {
            if (!range || typeof range !== "object") continue;

            const record = range as Record<string, unknown>;
            const start = toSeconds(record.start);
            const end = toSeconds(record.end);

            if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
            if (end - start < MIN_SEGMENT_SECONDS) continue;

            segments.push({
                id: String(record.id ?? crypto.randomUUID()),
                start,
                end,
                kind: "skip",
                source: "manual",
            });
        }
    }

    const jump = toSeconds(jumpConfig);
    if (Number.isFinite(jump) && jump > 0) {
        segments.push({
            id: crypto.randomUUID(),
            start: jump,
            end: 0, // 到视频结尾
            kind: "next",
            source: "manual",
        });
    }

    return segments.sort((a, b) => {
        // 下一P 永远排在最后
        if (a.kind !== b.kind) return a.kind === "next" ? 1 : -1;
        return a.start - b.start;
    });
}

/** 解析上传成功后服务端返回的片段列表 */
export function parseCreatedSegments(created: unknown): SkipSegment[] {
    if (!Array.isArray(created)) return [];

    const segments: SkipSegment[] = [];

    for (const raw of created) {
        if (!raw || typeof raw !== "object") continue;

        const record = raw as Record<string, unknown>;
        const bounds = Array.isArray(record.segment) ? record.segment : [];
        const start = Number(bounds[0]);
        const end = Number(bounds[1]);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            continue;
        }

        segments.push({
            id: String(record.UUID ?? `${start}-${end}`),
            start,
            end,
            kind: record.category === "outro" ? "next" : "skip",
            source: "api",
        });
    }

    return segments;
}

/**
 * 读取片段配置；首次运行时自动把旧的 opRanges / jumpConfig 迁移过来，
 * 迁移完成后删除旧键。
 */
export async function loadSegments(): Promise<SkipSegment[]> {
    const stored = await browser.storage.local.get({
        segments: null,
        opRanges: [],
        jumpConfig: { h: 0, m: 0, s: 0 },
    });

    if (Array.isArray(stored.segments)) {
        return normalizeSegments(stored.segments);
    }

    const migrated = migrateLegacySegments(
        stored.opRanges,
        stored.jumpConfig,
    );

    await browser.storage.local.set({ [STORAGE_KEY]: migrated });
    await browser.storage.local.remove(["opRanges", "jumpConfig"]);

    return migrated;
}

export async function saveSegments(segments: SkipSegment[]): Promise<void> {
    await browser.storage.local.set({
        [STORAGE_KEY]: normalizeSegments(segments),
    });
}
