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

/** 存档列表对应的 storage key（Options 页监听变化时也用它） */
export const historyStorageKey = (kind: HistoryKind): string =>
    HISTORY_STORAGE_KEY[kind];

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

const isHistoryItem = (value: unknown): value is HistoryConfig => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return typeof record.url === "string" && typeof record.title === "string";
};

const readList = async (kind: HistoryKind): Promise<HistoryConfig[]> => {
    try {
        const stored = await browser.storage.local.get({
            [HISTORY_STORAGE_KEY[kind]]: [],
        });
        const list = stored[HISTORY_STORAGE_KEY[kind]];
        return Array.isArray(list) ? list.filter(isHistoryItem) : [];
    } catch {
        return [];
    }
};

const writeList = async (
    kind: HistoryKind,
    list: HistoryConfig[],
): Promise<void> => {
    await browser.storage.local.set({
        [HISTORY_STORAGE_KEY[kind]]: list.slice(0, MAX_HISTORY_LENGTH),
    });
};

/**
 * 存档写操作串行化：background（自动 / 手动存档）与 Options 页（删除 / 清空）
 * 会并发改同一份列表，先读后写的整体覆盖会互相丢条目。
 * 扩展页与 service worker 同源，优先用 Web Locks 做跨上下文互斥。
 */
const HISTORY_LOCK = "bmc-history-write";
let localWriteQueue: Promise<unknown> = Promise.resolve();

const withHistoryLock = <T>(task: () => Promise<T>): Promise<T> => {
    const locks =
        typeof navigator !== "undefined" ? navigator.locks : undefined;

    if (locks?.request) {
        return locks.request(HISTORY_LOCK, task) as Promise<T>;
    }

    const run = localWriteQueue.then(task, task);
    localWriteQueue = run.catch(() => undefined);
    return run;
};

/** 读取某个存档列表（最多 limit 条，默认 20 条） */
export async function readHistory(
    kind: HistoryKind,
    limit = MAX_HISTORY_LENGTH,
): Promise<HistoryConfig[]> {
    const list = await readList(kind);
    return list.slice(0, Math.max(0, limit));
}

/** 删除单条记录：现读现改，不会用页面上的旧快照覆盖 storage */
export async function removeHistoryItem(
    kind: HistoryKind,
    url: string,
): Promise<HistoryConfig[]> {
    return withHistoryLock(async () => {
        const list = await readList(kind);
        const target = cleanBiliUrl(url);
        const next = list.filter(
            (item) => cleanBiliUrl(item.url) !== target,
        );

        if (next.length !== list.length) await writeList(kind, next);
        return next;
    });
}

/** 清空某个存档列表 */
export async function clearHistory(kind: HistoryKind): Promise<void> {
    await withHistoryLock(async () => {
        await browser.storage.local.set({
            [HISTORY_STORAGE_KEY[kind]]: [],
        });
    });
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
    return withHistoryLock(async () => {
        const list = await readList(kind);
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

        await writeList(kind, next);
        return next;
    });
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
