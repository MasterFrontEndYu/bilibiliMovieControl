// content/index.ts
import { render } from "solid-js/web";
import { createSignal, Show, onCleanup } from "solid-js";
import { browser } from "wxt/browser";
import {
    initFrameAnalyzer,
    getMainVideo,
    checkEndingByFrame,
    resetFrameAnalyzer,
    destroyFrameAnalyzer,
} from "../utils/frameAnalyzer";
import { isPageInPinnedHistory } from "@/utils/bili";
import { TimeRange, TimePoint } from "@/assets/types";

// ==================== 类型定义 ====================
interface Config {
    opRanges: TimeRange[];
    frameConfig: TimePoint;
    jumpConfig: TimePoint;
    mode: "frame" | "manual";
    isAutoHandle: boolean;
}

// ==================== 默认配置 ====================
const DEFAULT_CONFIG: Config = {
    opRanges: [],
    frameConfig: { h: 0, m: 0, s: 0 },
    jumpConfig: { h: 0, m: 0, s: 0 },
    mode: "frame",
    isAutoHandle: true,
};

// ==================== Content Script 主入口 ====================
export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        // ---------- 1. 响应式状态 ----------
        const [opRanges, setOpRanges] = createSignal<TimeRange[]>([]);
        const [frameConfig, setFrameConfig] = createSignal<TimePoint>({
            h: 0,
            m: 0,
            s: 0,
        });
        const [jumpConfig, setJumpConfig] = createSignal<TimePoint>({
            h: 0,
            m: 0,
            s: 0,
        });
        const [isPageReady, setIsPageReady] = createSignal(false);
        const [mode, setMode] = createSignal<"frame" | "manual">("frame");
        const [isAnalyzing, setIsAnalyzing] = createSignal(false);
        const [isAutoHandle, setIsAutoHandle] = createSignal(true);

        // ---------- 2. 工具函数 ----------
        const toSeconds = (t: TimePoint) =>
            (t.h || 0) * 3600 + (t.m || 0) * 60 + (t.s || 0);

        const pad = (n: number) => n.toString().padStart(2, "0");
        const formatTime = (t: TimePoint) => `${t.h}:${pad(t.m)}:${pad(t.s)}`;

        // ---------- 3. 配置管理（统一数据源） ----------
        // 更新内存状态 + 持久化（仅当需要保存时）
        const updateConfig = (data: Partial<Config>) => {
            if (data.opRanges !== undefined) setOpRanges(data.opRanges);
            if (data.frameConfig !== undefined)
                setFrameConfig(data.frameConfig);
            if (data.jumpConfig !== undefined) setJumpConfig(data.jumpConfig);
            if (data.mode !== undefined) setMode(data.mode);
            if (data.isAutoHandle !== undefined)
                setIsAutoHandle(data.isAutoHandle);
        };

        // 从 storage 加载初始配置
        const stored = await browser.storage.local.get(
            Object.keys(DEFAULT_CONFIG),
        );
        const initialConfig = { ...DEFAULT_CONFIG, ...stored };
        updateConfig(initialConfig);

        // 监听 storage 变化（来自其他扩展页面，如 Options）
        const storageListener = (
            changes: Record<string, any>,
            area: string,
        ) => {
            if (area !== "local") return;
            const data: Partial<Config> = {};
            for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
                if (changes[key]) {
                    data[key] = changes[key].newValue;
                }
            }
            if (Object.keys(data).length) {
                updateConfig(data);
                mountUI(); // 配置变化可能影响 UI 显示，刷新 UI
            }
        };
        browser.storage.onChanged.addListener(storageListener);

        // ---------- 4. UI 挂载 ----------
        let disposeUI: (() => void) | null = null;

        // 获取当前视频信息区域的锚点
        const getAnchor = (): HTMLElement | null => {
            return (document.getElementById("viewbox_report") ||
                document.querySelector(".video-info-title") ||
                document.querySelector(".cl-info-title")) as HTMLElement | null;
        };

        const mountUI = () => {
            if (!isPageReady()) return;

            const anchor = getAnchor();
            if (!anchor) return;

            // 若已存在挂载点但父节点不是当前锚点，则移除旧挂载点
            let mountPoint = document.getElementById(
                "bili-skip-wrapper-unique",
            );
            if (mountPoint && mountPoint.parentElement !== anchor) {
                mountPoint.remove();
                mountPoint = null;
                // 清理旧的渲染
                if (disposeUI) {
                    disposeUI();
                    disposeUI = null;
                }
            }

            // 如果没有挂载点，创建新的
            if (!mountPoint) {
                mountPoint = document.createElement("span");
                mountPoint.id = "bili-skip-wrapper-unique";
                anchor.appendChild(mountPoint);

                // 注入动画样式（只注入一次）
                if (!document.getElementById("bili-skip-style")) {
                    const style = document.createElement("style");
                    style.id = "bili-skip-style";
                    style.textContent = `
                        @keyframes blink {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }

                // 渲染 Solid 组件
                disposeUI = render(
                    () => (
                        <Show when={isPageReady()}>
                            <div
                                style={{
                                    display: "inline-flex",
                                    "align-items": "center",
                                    gap: "8px",
                                    padding: "1px 12px",
                                    background: "#fb7299",
                                    color: "white",
                                    "border-radius": "8px",
                                    "font-size": "12px",
                                    "vertical-align": "middle",
                                    "box-shadow":
                                        "0 2px 6px rgba(251,114,153,0.3)",
                                    "font-family": "sans-serif",
                                }}
                            >
                                <span title="跳过段数">
                                    ⏭ {opRanges().length} 段
                                </span>
                                <span style={{ opacity: 0.5 }}>|</span>
                                <span>
                                    {mode() === "manual"
                                        ? `🏁 切集起点: ${formatTime(
                                              jumpConfig(),
                                          )}`
                                        : `🔍 分析起点: ${formatTime(
                                              frameConfig(),
                                          )}`}
                                </span>
                                <span
                                    style={{
                                        display: "inline-block",
                                        width: "8px",
                                        "margin-left": "4px",
                                        animation: "blink 1s infinite",
                                        color: "#fff",
                                    }}
                                >
                                    {isAnalyzing() ? "●" : ""}
                                </span>
                            </div>
                        </Show>
                    ),
                    mountPoint,
                );
            }
            // 如果挂载点已存在，Solid 组件会自动响应信号变化，无需操作
        };

        // ---------- 5. 跳转逻辑 ----------
        let lastJumpTime = 0;
        const executeJump = () => {
            const now = Date.now();
            if (now - lastJumpTime < 3000) return; // 防抖
            const nextBtn = document.querySelector(
                ".bpx-player-ctrl-next",
            ) as HTMLElement;
            if (nextBtn) {
                lastJumpTime = now;
                nextBtn.click();
                resetFrameAnalyzer();
                setIsAnalyzing(false); // 重置分析状态
            }
        };

        // ---------- 6. 核心控制逻辑 ----------
        let lastFrameCheckTime = 0;
        const FRAME_CHECK_INTERVAL = 200; // 毫秒

        const runControlLogic = () => {
            const video = getMainVideo();
            if (!video || video.readyState < 2) return;

            const cur = video.currentTime;

            // 6.1 处理 OP 跳过
            for (const range of opRanges()) {
                const start = toSeconds(range.start);
                const end = toSeconds(range.end);
                if (end > start && cur >= start && cur < end) {
                    video.currentTime = end;
                    return;
                }
            }

            // 6.2 切集逻辑
            if (mode() === "manual") {
                const jumpTime = toSeconds(jumpConfig());
                if (jumpTime > 0 && cur >= jumpTime) {
                    executeJump();
                }
            } else {
                // frame 模式
                const analyzeStartTime = toSeconds(frameConfig());
                if (analyzeStartTime > 0 && cur >= analyzeStartTime) {
                    if (!isAnalyzing()) setIsAnalyzing(true);

                    // 节流：每隔 FRAME_CHECK_INTERVAL 检查一次
                    const now = Date.now();
                    if (now - lastFrameCheckTime >= FRAME_CHECK_INTERVAL) {
                        lastFrameCheckTime = now;
                        try {
                            if (checkEndingByFrame(video, !video.paused)) {
                                executeJump();
                                setIsAnalyzing(false);
                            }
                        } catch (e) {
                            console.warn("[Frame Analyze] 分析异常:", e);
                        }
                    }
                } else {
                    if (isAnalyzing()) setIsAnalyzing(false);
                }
            }
        };

        // ---------- 7. 主循环 ----------
        let lastUrl = location.href;
        let cachedIsPinned = false;
        let cachedPinnedUrl = "";

        const mainTimer = setInterval(async () => {
            try {
                // 7.1 判断是否合集页
                const isCol = !!(
                    document.querySelector(".video-pod") ||
                    document.querySelector(".multi-page") ||
                    document.querySelector(".cur-list")
                );

                // 7.2 检查是否在固定历史中（仅在 URL 变化时重新计算）
                if (location.href !== cachedPinnedUrl) {
                    cachedPinnedUrl = location.href;
                    cachedIsPinned = await isPageInPinnedHistory(location.href);
                }

                // 7.3 计算是否运行逻辑（使用内存信号，不再读 storage）
                const runControl = isCol && (isAutoHandle() || cachedIsPinned);

                // 7.4 更新 ready 状态
                if (runControl !== isPageReady()) {
                    setIsPageReady(runControl);
                    // 通知 background（如果希望）
                    if (runControl) {
                        browser.runtime
                            .sendMessage({
                                type: "SYNC_PAGE_READY",
                                isPageReady: runControl,
                            })
                            .catch(() => {});
                    }
                }

                // 7.5 处理 URL 变化
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    lastJumpTime = 0;
                    resetFrameAnalyzer();
                    setIsAnalyzing(false);
                    // 延迟挂载 UI，等待新页面元素渲染
                    setTimeout(mountUI, 500);
                }

                // 7.6 执行 UI 挂载或移除
                if (runControl) {
                    mountUI();
                    runControlLogic();
                } else {
                    const ui = document.getElementById(
                        "bili-skip-wrapper-unique",
                    );
                    if (ui) ui.remove();
                    if (disposeUI) {
                        disposeUI();
                        disposeUI = null;
                    }
                }
            } catch (e) {
                console.error("[Main Loop] 异常:", e);
            }
        }, 1000);

        // ---------- 8. 消息监听 ----------
        const handleMessage = (msg: any, sender: any, sendResponse: any) => {
            try {
                if (msg.type === "UPDATE_CONFIG") {
                    updateConfig(msg.data);
                    // 注意：此处只更新内存，持久化已在 Options 页面完成（或通过 storage.onChanged 同步）
                    mountUI(); // 配置变化刷新 UI
                    // 可以返回响应
                    sendResponse({ success: true });
                    return true; // 保持响应通道
                }
                if (msg.type === "QUERY_READY_STATUS") {
                    sendResponse({ isPageReady: isPageReady() });
                    return true;
                }
            } catch (e) {
                console.warn("[Message] 处理错误:", e);
                sendResponse({ error: String(e) });
                return true;
            }
            return false; // 未处理的消息
        };
        browser.runtime.onMessage.addListener(handleMessage);

        // ---------- 9. 初始化分析器 ----------
        initFrameAnalyzer();

        // ---------- 10. 清理 ----------
        ctx.onInvalidated(() => {
            clearInterval(mainTimer);
            browser.runtime.onMessage.removeListener(handleMessage);
            browser.storage.onChanged.removeListener(storageListener);
            if (disposeUI) {
                disposeUI();
                disposeUI = null;
            }
            document.getElementById("bili-skip-wrapper-unique")?.remove();
            destroyFrameAnalyzer();
        });
    },
});
