import { browser } from "wxt/browser";
import { getCollectionTitle } from "@/utils/bili";
import { HistoryItem, TimePoint, TimeRange } from "@/assets/types";

import { MAX_HISTORY_LENGTH, cleanBiliUrl } from "@/utils/bili";

const DEBOUNCE_TIME = 2000;
const processedLogs = new Map<string, number>();

// TODO: 1. 地址问题，合集每个视频地址都不一样。所以手动功能只在一个视频上有效果，需要该改一下

export default defineBackground(() => {
    /**
     * 核心：处理手动存档 (Pinned)
     */
    const handleArchiveLogic = async (activeTab: any, config: any) => {
        const cleanedUrl = cleanBiliUrl(activeTab.url || "");
        const colTitle = await getCollectionTitle(activeTab.id);
        if (colTitle) {
            const currentData: HistoryItem = {
                id: activeTab?.id || Date.now(),
                title: colTitle,
                url: cleanedUrl, // 使用清洗后的 URL
                time: Date.now(),
                mode: config.mode,
                opRanges: config.opRanges,
                frameConfig: config.frameConfig,
                jumpConfig: config.jumpConfig,
            };

            const res = await browser.storage.local.get("pinnedHistory");
            const history = (res.pinnedHistory as HistoryItem[]) || [];

            // --- 2. 唯一性去重 ---
            const filteredHistory = history.filter(
                (item: HistoryItem) => cleanBiliUrl(item.url) !== cleanedUrl,
            );

            const newHistory = [currentData, ...filteredHistory].slice(
                0,
                MAX_HISTORY_LENGTH,
            );

            await browser.storage.local.set({ pinnedHistory: newHistory });
            return newHistory.slice(0, 3);
        }
    };

    /**
     * 自动记录最近历史 (Latest)
     */
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        const rawUrl: string = tab.url || "";

        if (
            changeInfo.status === "complete" &&
            rawUrl.includes("bilibili.com/video")
        ) {
            const cleanedUrl = cleanBiliUrl(rawUrl);
            const now = Date.now();

            // 防抖
            const lastTime = processedLogs.get(cleanedUrl) || 0;
            if (now - lastTime < DEBOUNCE_TIME) return;

            processedLogs.set(cleanedUrl, now);
            if (processedLogs.size > 50) {
                // 防止 Map 过大
                const firstKey = processedLogs.keys().next().value;
                if (firstKey) processedLogs.delete(firstKey);
            }

            const colTitle = await getCollectionTitle(tabId);
            if (colTitle) {
                // 读取当前最新的配置快照
                const storage = await browser.storage.local.get({
                    latestHistory: [],
                    opRanges: [],
                    frameConfig: { h: 0, m: 0, s: 0 },
                    jumpConfig: { h: 0, m: 0, s: 0 },
                    mode: "frame",
                });

                const newItem: HistoryItem = {
                    id: tabId,
                    title: colTitle,
                    url: cleanedUrl,
                    time: now,
                    opRanges: storage.opRanges as TimeRange[],
                    frameConfig: storage.frameConfig as TimePoint,
                    jumpConfig: storage.jumpConfig as TimePoint,
                    mode: storage.mode as "frame" | "manual",
                };

                const history = (storage.latestHistory as any[]) || [];
                const filteredLatest = history.filter(
                    (item: any) => cleanBiliUrl(item.url) !== cleanedUrl,
                );

                const newLatest = [newItem, ...filteredLatest].slice(
                    0,
                    MAX_HISTORY_LENGTH,
                );
                await browser.storage.local.set({ latestHistory: newLatest });

                // 广播更新通知给 Popup
                browser.runtime
                    .sendMessage({
                        type: "REFRESH_HISTORY",
                        data: newLatest.slice(0, 2), // 直接传递数组
                    })
                    .catch(() => {});
            }
        }
    });

    /**
     * 监听消息请求
     */
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "DO_ARCHIVE") {
            handleArchiveLogic(message.data.tab, message.data.config).then(
                (newPinned) => {
                    sendResponse({ success: true, pinnedHistory: newPinned });
                },
            );
            return true; // 保持异步通道开启
        }
    });
});
