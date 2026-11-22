import { browser } from "wxt/browser";
import {
    cleanBiliUrl,
    getCollectionTitle,
    MAX_HISTORY_LENGTH,
} from "@/utils/bilibili";
import { loadSegments } from "@/utils/segments";
import type {
    HistoryConfig,
    HistoryKind,
    HistorySnapshot,
    SkipSegment,
} from "@/types/types";

const HISTORY_STORAGE_KEY: Record<HistoryKind, string> = {
    latest: "latestHistory",
    pinned: "pinnedHistory",
};

/** 同一 URL 的自动存档防抖 */
const THROTTLE_MS = 2000;
const MAX_THROTTLE_ENTRIES = 50;
const processedLogs = new Map<string, number>();

/**
 * 同一 URL 在 THROTTLE_MS 内只允许记录一次。
 * @returns true 表示本次可以记录
 */
export function allowArchive(url: string, now = Date.now()): boolean {
    const lastTime = processedLogs.get(url) ?? 0;
    if (now - lastTime < THROTTLE_MS) return false;

    processedLogs.set(url, now);
    if (processedLogs.size > MAX_THROTTLE_ENTRIES) {
        const firstKey = processedLogs.keys().next().value;
        if (firstKey) processedLogs.delete(firstKey);
    }

    return true;
}

/**
 * 自动存档 / 手动存档共用的落库逻辑：
 * 按清理后的 URL 去重 → 新记录置顶 → 截断到上限 → 写入对应 storage key。
 * @returns 写入后的完整列表
 */
export async function upsertHistory(
    kind: HistoryKind,
    snapshot: HistorySnapshot,
): Promise<HistoryConfig[]> {
    const storageKey = HISTORY_STORAGE_KEY[kind];
    const stored = await browser.storage.local.get({ [storageKey]: [] });
    const list = (stored[storageKey] as HistoryConfig[] | undefined) ?? [];
    const url = cleanBiliUrl(snapshot.url);

    const item: HistoryConfig = {
        id: snapshot.id ?? 0,
        title: snapshot.title,
        url,
        time: Date.now(),
        segments: snapshot.segments,
    };

    const next = [
        item,
        ...list.filter((entry) => cleanBiliUrl(entry.url) !== url),
    ].slice(0, MAX_HISTORY_LENGTH);

    await browser.storage.local.set({ [storageKey]: next });
    return next;
}

/**
 * 手动存档（Pinned）：由 Popup 的「手动存档」按钮触发。
 * @returns 最近 3 条，供 Popup 列表展示；无合集标题时返回 undefined
 */
export async function archiveManual(
    tab: { id: number; url?: string },
    config: { segments: SkipSegment[] },
): Promise<HistoryConfig[] | undefined> {
    const title = await getCollectionTitle(tab.id);
    if (!title) return;

    const list = await upsertHistory("pinned", {
        id: tab.id,
        title,
        url: tab.url ?? "",
        segments: config.segments,
    });

    return list.slice(0, 3);
}

/**
 * 自动存档（Latest）：读取当前配置快照后写入 latestHistory。
 */
export async function archiveLatest(
    tabId: number,
    url: string,
): Promise<void> {
    const title = await getCollectionTitle(tabId);
    if (!title) return;

    const segments = await loadSegments();

    await upsertHistory("latest", {
        id: tabId,
        title,
        url,
        segments,
    });
}
