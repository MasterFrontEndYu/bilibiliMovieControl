import { browser } from "wxt/browser";
import type { ApiSegment } from "@/types/types";

const CACHE_STORAGE_KEY = "sbSegmentCacheV2";
const MAX_CACHE_ENTRIES = 100;

interface SegmentCacheEntry {
    at: number; // 写入时间，用于 LRU 裁剪
    expiresAt: number; // 过期时间戳
    segments: ApiSegment[];
}

type SegmentCache = Record<string, SegmentCacheEntry>;

async function readCache(): Promise<SegmentCache> {
    try {
        const stored = await browser.storage.local.get({
            [CACHE_STORAGE_KEY]: {},
        });
        const value = stored[CACHE_STORAGE_KEY];
        return value && typeof value === "object"
            ? (value as SegmentCache)
            : {};
    } catch {
        return {};
    }
}

/**
 * 读取缓存；未命中或已过期返回 null。
 * 空数组也是有效缓存（表示该视频确实没有片段），因此用 null 表示未命中。
 */
export async function readCachedSegments(
    key: string,
    now = Date.now(),
): Promise<ApiSegment[] | null> {
    const cache = await readCache();
    const entry = cache[key];
    if (!entry || entry.expiresAt <= now) return null;
    return entry.segments ?? null;
}

/**
 * 清掉某个 BVID 相关的缓存（上传成功后调用，避免继续读到旧的空结果）
 */
export async function invalidateCachedSegments(bvid: string): Promise<void> {
    try {
        const cache = await readCache();
        let changed = false;

        for (const key of Object.keys(cache)) {
            if (key === bvid || key.startsWith(`${bvid}:`)) {
                delete cache[key];
                changed = true;
            }
        }

        if (changed) {
            await browser.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
        }
    } catch {
        // 忽略：缓存失效失败不影响主流程
    }
}

/**
 * 写入缓存并清理过期项、按写入时间保留最近 MAX_CACHE_ENTRIES 条。
 * 缓存只是性能优化，任何失败都静默忽略。
 */
export async function writeCachedSegments(
    key: string,
    segments: ApiSegment[],
    ttlMs: number,
    now = Date.now(),
): Promise<void> {
    try {
        const cache = await readCache();
        cache[key] = { at: now, expiresAt: now + ttlMs, segments };

        const alive = Object.entries(cache)
            .filter(([, entry]) => entry.expiresAt > now)
            .sort((a, b) => b[1].at - a[1].at)
            .slice(0, MAX_CACHE_ENTRIES);

        await browser.storage.local.set({
            [CACHE_STORAGE_KEY]: Object.fromEntries(alive),
        });
    } catch {
        // 忽略：缓存写入失败不影响主流程
    }
}
