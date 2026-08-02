import { browser } from "wxt/browser";
import { getCollectionTitle } from "@/utils/bilibili";
import { HistoryConfig, TimePoint, TimeRange } from "@/types/types";

import { MAX_HISTORY_LENGTH } from "@/utils/bilibili";

const DEBOUNCE_TIME = 2000;
const processedLogs = new Map<string, number>();

export default defineBackground(() => {
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

    /**
     * 核心：处理手动存档 (Pinned)
     */
    const handleArchiveLogic = async (activeTab: any, config: any) => {
        const colTitle = await getCollectionTitle(activeTab.id);

        if (colTitle) {
            const currentData: HistoryConfig = {
                id: activeTab?.id,
                title: colTitle,
                url: cleanBiliUrl(activeTab?.url),
                time: Date.now(),
                mode: config.mode,
                opRanges: config.opRanges,
                frameConfig: config.frameConfig,
                jumpConfig: config.jumpConfig,
            };

            const res = await browser.storage.local.get("pinnedHistory");

            const history = (res.pinnedHistory as HistoryConfig[]) || [];

            const filteredHistory = history.filter(
                (item: HistoryConfig) =>
                    cleanBiliUrl(item.url) !== cleanBiliUrl(activeTab.url),
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
        await new Promise((resolve) => setTimeout(resolve, 4000));
        if (
            changeInfo.status === "complete" &&
            tab.url?.includes("bilibili.com/video")
        ) {
            const rawUrl: string = cleanBiliUrl(tab.url || "") || "";
            const now = Date.now();

            // 防抖
            const lastTime = processedLogs.get(rawUrl) || 0;
            if (now - lastTime < DEBOUNCE_TIME) return;

            processedLogs.set(rawUrl, now);
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

                const newItem: HistoryConfig = {
                    id: tabId,
                    title: colTitle,
                    url: rawUrl,
                    time: now,
                    opRanges: storage.opRanges as TimeRange[],
                    frameConfig: storage.frameConfig as TimePoint,
                    jumpConfig: storage.jumpConfig as TimePoint,
                    mode: storage.mode as "frame" | "manual",
                };

                const history = (storage.latestHistory as any[]) || [];
                const filteredLatest = history.filter(
                    (item: any) => cleanBiliUrl(item.url) !== rawUrl,
                );

                const newLatest = [newItem, ...filteredLatest].slice(
                    0,
                    MAX_HISTORY_LENGTH,
                );
                await browser.storage.local.set({ latestHistory: newLatest });
            }
        }
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
