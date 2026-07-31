import { createSignal } from "solid-js";
import { browser } from "wxt/browser";
import { TimePoint, TimeRange, BiliVideoConfig } from "@/types/types";

export const useStorageConfig = () => {
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
    const [isAutoHandle, setIsAutoHandle] = createSignal(false);
    const [isPageReady, setIsPageReady] = createSignal(false);

    const updateConfig = (data: Partial<BiliVideoConfig>) => {
        if (data.opRanges) setOpRanges(data.opRanges);
        if (data.frameConfig) setFrameConfig(data.frameConfig);
        if (data.jumpConfig) setJumpConfig(data.jumpConfig);
        if (data.mode) setMode(data.mode);
        if (data.isAutoHandle) setIsAutoHandle(data.isAutoHandle);
        if (data.isPageReady) setIsPageReady(data.isPageReady);
    };

    const initFromStorage = async () => {
        const res = await browser.storage.local.get([
            "opRanges",
            "frameConfig",
            "jumpConfig",
            "mode",
            "isAutoHandle",
        ]);

        if (res.opRanges) setOpRanges(res.opRanges as TimeRange[]);
        if (res.frameConfig) setFrameConfig(res.frameConfig as TimePoint);
        if (res.jumpConfig) setJumpConfig(res.jumpConfig as TimePoint);
        if (res.mode) setMode(res.mode as "frame" | "manual");
        if (res.isAutoHandle) setIsAutoHandle(res.isAutoHandle as boolean);
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
        isAutoHandle,
        setIsAutoHandle,
        isPageReady,
        setIsPageReady,
        updateConfig,
        initFromStorage,
    };
};
