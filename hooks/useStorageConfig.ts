import { createSignal } from "solid-js";
import { browser } from "wxt/browser";
import { TimePoint, TimeRange, HistoryItem } from "@/types/types";



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
    const [isPageReady, setIsPageReady] = createSignal(false);






}


