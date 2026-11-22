import { browser } from "wxt/browser";
import {
    cleanBiliUrl,
    getCollectionTitle,
    MAX_HISTORY_LENGTH,
} from "@/utils/bilibili";
import type { HistoryConfig, TimePoint, TimeRange } from "@/types/types";

const DEBOUNCE_TIME = 2000;
const processedLogs = new Map<string, number>();

/** 历史归档类型：latest = 自动存档，pinned = 手动存档 */
type HistoryKind = "latest" | "pinned";

const HISTORY_STORAGE_KEY: Record<HistoryKind, string> = {
    latest: "latestHistory",
    pinned: "pinnedHistory",
};

/** 两种存档共用的快照字段 */
interface HistorySnapshot {
    id?: number;
    title: string;
    url: string;
    opRanges: TimeRange[];
    jumpConfig: TimePoint;
}

/**
 * 自动存档 / 手动存档共用的落库逻辑：
 * 按清理后的 URL 去重 → 新记录置顶 → 截断到上限 → 写入对应 storage key。
 * @returns 写入后的完整列表
 */
async function upsertHistory(
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
        opRanges: snapshot.opRanges,
        jumpConfig: snapshot.jumpConfig,
    };

    const next = [
        item,
        ...list.filter((entry) => cleanBiliUrl(entry.url) !== url),
    ].slice(0, MAX_HISTORY_LENGTH);

    await browser.storage.local.set({ [storageKey]: next });
    return next;
}

export default defineBackground(() => {
    /**
     * 监听消息请求
     */
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "DO_ARCHIVE") {
            handleManualArchive(message.data.tab, message.data.config).then(
                (newPinned) => {
                    sendResponse({ success: true, pinnedHistory: newPinned });
                },
            );
            return true; // 保持异步通道开启
        }
    });

    /**
     * 手动存档 (Pinned)：由 Popup 的「手动存档」按钮触发
     */
    const handleManualArchive = async (activeTab: any, config: any) => {
        const title = await getCollectionTitle(activeTab.id);

        if (!title) return;

        const list = await upsertHistory("pinned", {
            id: activeTab.id,
            title,
            url: activeTab.url,
            opRanges: config.opRanges,
            jumpConfig: config.jumpConfig,
        });

        // Popup 只展示最近 3 条
        return list.slice(0, 3);
    };

    /**
     * 自动存档 (Latest)：页面加载完成后记录当前配置快照
     */
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        // 等页面与配置稳定后再记录
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const pageUrl = tab.url;
        if (changeInfo.status !== "complete" || !pageUrl?.includes("bilibili.com/video")) {
            return;
        }

        const cleanUrl = cleanBiliUrl(pageUrl);
        const now = Date.now();

        // 同一 URL 短时间内只记录一次
        const lastTime = processedLogs.get(cleanUrl) || 0;
        if (now - lastTime < DEBOUNCE_TIME) return;

        processedLogs.set(cleanUrl, now);
        if (processedLogs.size > 50) {
            // 防止 Map 无限增长
            const firstKey = processedLogs.keys().next().value;
            if (firstKey) processedLogs.delete(firstKey);
        }

        const title = await getCollectionTitle(tabId);
        if (!title) return;

        // 读取当前最新的配置快照
        const storage = await browser.storage.local.get({
            opRanges: [],
            jumpConfig: { h: 0, m: 0, s: 0 },
        });

        await upsertHistory("latest", {
            id: tabId,
            title,
            url: cleanUrl,
            opRanges: storage.opRanges as TimeRange[],
            jumpConfig: storage.jumpConfig as TimePoint,
        });
    });

    /**
     * 根据用户打开的页面判断是否为video页，并设置icon
     */
    async function updateIcon(isActive: boolean) {
        const suffix = isActive ? "active" : "inactive";
        try {
            await browser.action.setIcon({
                path: {
                    16: `icon/icon-16-${suffix}.png`,
                    32: `icon/icon-32-${suffix}.png`,
                    48: `icon/icon-48-${suffix}.png`,
                    96: `icon/icon-96-${suffix}.png`,
                    128: `icon/icon-128-${suffix}.png`,
                },
            });
        } catch (error) {
            console.error("更新图标失败:", error);
        }
    }

    async function updatePageReadyViaPing() {
        try {
            const [tab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (!tab || !tab.id || !tab.url) {
                await browser.storage.local.set({ isPageReady: false });
                updateIcon(false);
                return;
            }
            // 尝试发送消息，如果成功说明 content script 存活
            const response = await browser.tabs.sendMessage(tab.id, {
                type: "PING",
            });
            if (response && response.alive === true) {
                await browser.storage.local.set({ isPageReady: true });
                updateIcon(true);
            } else {
                await browser.storage.local.set({ isPageReady: false });
                updateIcon(false);
            }
        } catch {
            // 发送失败，说明 content script 不存在
            await browser.storage.local.set({ isPageReady: false });
            updateIcon(false);
        }
    }

    // 1. 监听标签页切换和更新
    browser.tabs.onActivated.addListener(updatePageReadyViaPing);
    // 2. 监听地址栏变化
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete" && tab.active) {
            updatePageReadyViaPing();
        }
    });
    // 3. storage 变化
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.isPageReady) {
            updateIcon(changes.isPageReady.newValue as boolean);
        }
    });

    // 初始执行
    updatePageReadyViaPing();
});
