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
import { isPageInPinnedHistory, createStorageListener } from "@/utils/bili";
import { TimeRange, TimePoint, BiliVideoConfig } from "@/types/types";

import { VideoUI } from "@/components/VideoUI";

// TODO 1. 存档保存，地址问题与local.host 不一致的问题，需要统一方法。
// TODO 2. popup图标要更据状态显示不同图标。
// TODO 3. 新增样式选择，给用户选择不同的UI样式，需要完成 - 设置时间如同老方法显示在页面上。

// TODO 4. 历史记录这样保存。合集名+合集具体内容二维数组保存，popup 还是老样子保存最新的单级，标题用css但行限制每而不是截取标题。
//         合集数据添加一个合集标识。

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const { config, setConfig, updateConfig, initFromStorage } =
            useStorageConfig();

        const [isAnalyzing, setIsAnalyzing] = createSignal(false);

        // ---------- 2. 工具函数 ----------
        const toSeconds = (t: TimePoint) =>
            (t.h || 0) * 3600 + (t.m || 0) * 60 + (t.s || 0);

        const pad = (n: number) => n.toString().padStart(2, "0");
        const formatTime = (t: TimePoint) => `${t.h}:${pad(t.m)}:${pad(t.s)}`;

        // ---------- 3. 配置管理（统一数据源） ----------
        // 从 storage 加载初始配置
        await initFromStorage();

        // 监听 storage 变化（来自其他扩展页面，如 Options）
        const storageListener = createStorageListener(
            STORAGE_KEYS,
            (data: Partial<BiliVideoConfig>) => {
                setConfig(data);
            },
        );

        // 注册监听 DOM url 变化
        ctx.addEventListener(window, "wxt:locationchange", async ({ newUrl }) => {
            console.log("URL changed to:", newUrl);
            // 在这里执行 URL 变化后的逻辑，例如重新挂载 UI
            cachedIsPinned = await isPageInPinnedHistory(location.href);
            lastJumpTime = 0;
            resetFrameAnalyzer();
            setIsAnalyzing(false);
        });

        // 注册监听 storage 储存变化
        browser.storage.onChanged.addListener(storageListener);

        // ---------- 4. UI 挂载 ----------

        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: () => {
                // 动态返回当前锚点
                return (
                    ((document.getElementById("viewbox_report") ||
                        document.querySelector(".video-info-title") ||
                        document.querySelector(
                            ".cl-info-title",
                        )) as HTMLElement) || document.body
                );
            },
            onMount: (container) => {
                // 注入样式（只一次）
                if (!document.getElementById("bili-skip-style")) {
                    const style = document.createElement("style");
                    style.id = "bili-skip-style";
                    style.textContent = `@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`;
                    document.head.appendChild(style);
                }

                // 渲染 Solid 组件，返回清理函数
                return render(
                    () => (
                        <VideoUI
                            opRanges={config.opRanges}
                            formatTime={formatTime}
                            jumpConfig={config.jumpConfig}
                            frameConfig={config.frameConfig}
                            mode={config.mode}
                            isAnalyzing={isAnalyzing}
                        />
                    ),
                    container,
                );
            },
            onRemove: (unmount) => {
                unmount?.(); // 清理 Solid 渲染
            },
        });

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
            for (const range of config.opRanges) {
                const start = toSeconds(range.start);
                const end = toSeconds(range.end);
                if (end > start && cur >= start && cur < end) {
                    video.currentTime = end;
                    return;
                }
            }

            // 6.2 切集逻辑
            if (config.mode === "manual") {
                const jumpTime = toSeconds(config.jumpConfig);
                setIsAnalyzing(false);
                if (jumpTime > 0 && cur >= jumpTime) {
                    executeJump();
                }
            } else {
                // frame 模式
                const analyzeStartTime = toSeconds(config.frameConfig);
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
        let lastPageState = false;
        let cachedIsPinned = false;
        let cachedPinnedUrl = "";

        ctx.setInterval(async () => {
            try {
                // 7.1 判断是否合集页
                const isCol = !!(
                    document.querySelector(".video-pod") ||
                    document.querySelector(".multi-page") ||
                    document.querySelector(".cur-list")
                );

                // console.log("isCol", isCol);
                // console.log("isAutoHandle", config.isAutoHandle);
                // console.log("cachedIsPinned", cachedIsPinned);

                // 7.3 计算是否运行逻辑（使用内存信号，不再读 storage）
                const runControl =
                    isCol && (config.isAutoHandle || cachedIsPinned);

                // console.log("runControl:", runControl, "lastPageState:", lastPageState);

                // 7.4 更新 ready 状态
                if (runControl !== lastPageState) {
                    lastPageState = runControl;
                    await browser.storage.local.set({
                        isPageReady: runControl,
                    });
                    // console.log("-----------------UI 加载--------------------");
                    ui.mount();
                }

                // 7.6 执行 UI 挂载或移除
                if (runControl) {
                    runControlLogic();
                } else {
                    if (ui) ui.remove();
                }
            } catch (e) {
                console.error("[Main Loop] 异常:", e);
            }
        }, 1000);

        // ---------- 9. 初始化分析器 ----------
        initFrameAnalyzer();

        // ---------- 10. 清理 ----------
        ctx.onInvalidated(() => {
            browser.storage.onChanged.removeListener(storageListener);
            document.getElementById("bili-skip-wrapper-unique")?.remove();
            destroyFrameAnalyzer();
        });
    },
});
