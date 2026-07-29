import { createSignal } from "solid-js";
import { browser } from "wxt/browser";
import { TimePoint, TimeRange, HistoryItem } from "@/assets/types";

import { getActiveTab, sendToActiveTab } from "@/utils/bili";

export const useBiliConfig = () => {
    // --- 1. 跳过列表 (用于 TimeRangeManager 弹窗) ---
    const [opRanges, setOpRanges] = createSignal<TimeRange[]>([]);

    // --- 2. 帧分析配置 (用于自动模式：label="帧") ---
    const [frameConfig, setFrameConfig] = createSignal<TimePoint>({
        h: 0,
        m: 0,
        s: 0,
    });

    // --- 3. 手动切集配置 (用于手动模式：label="切") ---
    const [jumpConfig, setJumpConfig] = createSignal<TimePoint>({
        h: 0,
        m: 0,
        s: 0,
    });

    // --- 4. 基础状态 ---
    const [mode, setMode] = createSignal<"frame" | "manual">("manual");
    const [isPageReady, setIsPageReady] = createSignal(false);
    const [latestHistory, setLatestHistory] = createSignal<HistoryItem[]>([]);
    const [pinnedHistory, setPinnedHistory] = createSignal<HistoryItem[]>([]);

    /**
     * 初始化：从本地存储加载所有数据
     */
    const initFromStorage = async () => {
        const res = await browser.storage.local.get([
            "opRanges",
            "frameConfig",
            "jumpConfig",
            "mode",
            "latestHistory",
            "pinnedHistory",
            "isPageReady",
        ]);

        if (res.opRanges) setOpRanges(res.opRanges as TimeRange[]);
        if (res.frameConfig) setFrameConfig(res.frameConfig as TimePoint);
        if (res.jumpConfig) setJumpConfig(res.jumpConfig as TimePoint);
        if (res.mode) setMode(res.mode as "frame" | "manual");
        if (res.isPageReady) setIsPageReady(res.isPageReady as boolean);

        if (Array.isArray(res.latestHistory))
            setLatestHistory(res.latestHistory.slice(0, 2) as HistoryItem[]);
        if (Array.isArray(res.pinnedHistory))
            setPinnedHistory(res.pinnedHistory.slice(0, 3) as HistoryItem[]);
    };

    /**
     * 保存模式切换
     */
    const saveMode = async (newMode: "frame" | "manual") => {
        setMode(newMode);
        await browser.storage.local.set({ mode: newMode });

        // await sendToActiveTab({
        //     type: "UPDATE_CONFIG",
        //     data: { mode: newMode },
        // });
    };

    /**
     * 应用配置：将当前所有状态写入 Storage 并广播给 Content Script
     */
    const applyConfig = async (type: "setting" | "reset") => {
        if (type === "reset") {
            const zero = { h: 0, m: 0, s: 0 };
            if (mode() === "frame") {
                setFrameConfig(zero);
            } else {
                setJumpConfig(zero);
            }
        }

        const configData = {
            opRanges: opRanges(),
            frameConfig: frameConfig(),
            jumpConfig: jumpConfig(),
            mode: mode(),
        };

        // 1. 持久化
        await browser.storage.local.set(configData);

        // await sendToActiveTab({
        //     type: "UPDATE_CONFIG",
        //     data: configData,
        // });
    };

    /**
     * 存档逻辑：将当前配置存入历史记录
     */
    const handleArchive = async () => {
        console.log(1111);
        const activeTab = await getActiveTab();
        console.log(activeTab);
        // 2. 校验逻辑依然保持，但代码更整洁
        if (!activeTab?.id) return;

        // 3. 发送存档请求
        const response = await browser.runtime.sendMessage({
            type: "DO_ARCHIVE",
            data: {
                // 这里利用 getActiveTab 返回的对象
                tab: {
                    id: activeTab.id,
                    title: activeTab.title,
                    url: activeTab.url,
                },
                config: {
                    mode: mode(),
                    opRanges: opRanges(),
                    frameConfig: frameConfig(),
                    jumpConfig: jumpConfig(),
                },
            },
        });

        if (response?.pinnedHistory) {
            setPinnedHistory(response.pinnedHistory);
        }
    };

    /**
     * TimeRangeManager 更新回调：更新 opRanges 并立即应用配置
     */
    const handleUpdateOpRanges = async (newRanges: TimeRange[]) => {
        setOpRanges(newRanges);
        await browser.storage.local.set({ opRanges: newRanges });
        // await sendToActiveTab({
        //     type: "UPDATE_CONFIG",
        //     data: { opRanges: newRanges },
        // });
    };

    /**
     * 加载历史记录到当前页面
     */
    const loadHistory = async (item: HistoryItem) => {
        await browser.tabs.update({ url: item.url });
        window.close();
    };

    /**
     * 打开配置页
     */
    const openOptions = () => {
        browser.tabs.create({ url: browser.runtime.getURL("/options.html") });
    };

    return {
        opRanges,
        setOpRanges,
        frameConfig,
        setFrameConfig,
        jumpConfig,
        setJumpConfig,
        mode,
        setMode,
        isPageReady,
        setIsPageReady,
        latestHistory,
        setLatestHistory,
        pinnedHistory,

        // 方法
        initFromStorage,
        saveMode,
        applyConfig,
        handleArchive,
        loadHistory,
        openOptions,
        handleUpdateOpRanges,
    };
};
