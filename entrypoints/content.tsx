// content/index.ts
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { browser } from "wxt/browser";
import {
    initFrameAnalyzer,
    getMainVideo,
    checkEndingByFrame,
    resetFrameAnalyzer,
    destroyFrameAnalyzer,
} from "../utils/frameAnalyzer";
import {
    createStorageListener,
    formatTime,
    toSeconds,
    TARGET_ID,
    BTN_CLASS,
} from "@/utils/bilibili";
import { BiliVideoConfig } from "@/types/types";
import { STORAGE_KEYS } from "@/hooks/useStorageConfig";
import { VideoUI } from "@/components/VideoUI";

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        // ---------- 1. 配置管理 ----------
        const { config, setConfig, initFromStorage } = useStorageConfig();
        const [isAnalyzing, setIsAnalyzing] = createSignal(false);

        await initFromStorage();

        const storageListener = createStorageListener(
            STORAGE_KEYS,
            (data: Partial<BiliVideoConfig>) => setConfig(data),
        );
        browser.storage.onChanged.addListener(storageListener);

        // ---------- 2. 工具函数：等待元素出现 ----------
        const waitForElement = (selector: string, timeout = 10000) =>
            new Promise<Element | null>((resolve) => {
                const existing = document.querySelector(selector);
                if (existing) return resolve(existing);
                const obs = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        obs.disconnect();
                        resolve(el);
                    }
                });
                obs.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => {
                    obs.disconnect();
                    resolve(null);
                }, timeout);
            });

        // ---------- 3. UI 挂载 ----------
        let uiMounted = false;
        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: () => document.getElementById(TARGET_ID) as HTMLElement,
            onMount: (container) => {
                if (!document.getElementById("bili-skip-style")) {
                    const style = document.createElement("style");
                    style.id = "bili-skip-style";
                    style.textContent = `@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`;
                    document.head.appendChild(style);
                }
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
            onRemove: (unmount) => unmount?.(),
        });

        const updateUi = (shouldMount: boolean) => {
            if (shouldMount && !uiMounted) {
                ui.mount();
                uiMounted = true;
            } else if (!shouldMount && uiMounted) {
                ui.remove();
                uiMounted = false;
            }
        };

        // ---------- 4. 跳转逻辑 ----------
        let lastJumpTime = 0;
        const executeJump = () => {
            const now = Date.now();
            if (now - lastJumpTime < 3000) return;
            const nextBtn = document.querySelector(BTN_CLASS) as HTMLElement;
            if (nextBtn) {
                lastJumpTime = now;
                nextBtn.click();
            }
        };

        // ---------- 5. 核心控制逻辑（保持不变） ----------
        let lastFrameCheckTime = 0;
        const FRAME_CHECK_INTERVAL = 200;

        const runControlLogic = () => {
            const video = getMainVideo();
            if (!video || video.readyState < 2) return;
            const cur = video.currentTime;

            // OP 跳过
            for (const range of config.opRanges) {
                const start = toSeconds(range.start);
                const end = toSeconds(range.end);
                if (end > start && cur >= start && cur < end) {
                    video.currentTime = end;
                    return;
                }
            }

            // 切集
            if (config.mode === "manual") {
                const jumpTime = toSeconds(config.jumpConfig);
                setIsAnalyzing(false);
                if (jumpTime > 0 && cur >= jumpTime) {
                    executeJump();
                }
            } else {
                const analyzeStartTime = toSeconds(config.frameConfig);
                if (analyzeStartTime > 0 && cur >= analyzeStartTime) {
                    if (!isAnalyzing()) setIsAnalyzing(true);
                    const now = Date.now();
                    if (now - lastFrameCheckTime >= FRAME_CHECK_INTERVAL) {
                        lastFrameCheckTime = now;
                        try {
                            if (checkEndingByFrame(video, !video.paused)) {
                                executeJump();
                                setIsAnalyzing(false);
                            }
                        } catch (e) {
                            lastFrameCheckTime = 0; // 异常后恢复
                            console.warn("[Frame Analyze] 异常:", e);
                        }
                    }
                } else {
                    if (isAnalyzing()) setIsAnalyzing(false);
                }
            }
        };

        // ---------- 6. 主循环（频率提高到 200ms） ----------
        let lastPageState = false;
        const mainLoop = async () => {
            try {
                const isCol = !!document.querySelector(".video-pod");
                const runControl = isCol && config.isAutoHandle;

                updateUi(runControl);

                if (runControl !== lastPageState) {
                    lastPageState = runControl;
                    await browser.storage.local.set({
                        isPageReady: runControl,
                    });
                }

                if (runControl) {
                    runControlLogic();
                }
            } catch (e) {
                console.error("[Main Loop] 异常:", e);
            }
        };

        // ---------- 7. 事件监听（合并 + 清理） ----------
        const messageListener = (msg: any, sender: any, sendResponse: any) => {
            if (msg.type === "PING") {
                sendResponse({ alive: lastPageState });
                return true;
            }
            return false;
        };
        browser.runtime.onMessage.addListener(messageListener);

        // 页面 URL 变化
        const locationChangeHandler = (event: Event) => {
            const newUrl =
                (event as CustomEvent).detail?.newUrl || (event as any).newUrl;
            if (!newUrl) return;
            lastJumpTime = 0;
            resetFrameAnalyzer();
            setIsAnalyzing(false);
            lastFrameCheckTime = 0;
        };
        ctx.addEventListener(
            window,
            "wxt:locationchange",
            locationChangeHandler,
        );

        // ---------- 8. 启动 ----------
        // 等待目标元素出现（替代硬延迟）
        await waitForElement(TARGET_ID);
        initFrameAnalyzer();

        // 主循环定时器（200ms，使帧检测节流生效）
        const mainInterval = ctx.setInterval(mainLoop, 200);

        // ---------- 9. 清理 ----------
        ctx.onInvalidated(() => {
            browser.storage.onChanged.removeListener(storageListener);
            browser.runtime.onMessage.removeListener(messageListener);
            window.removeEventListener(
                "wxt:locationchange",
                locationChangeHandler,
            );
            updateUi(false);
            destroyFrameAnalyzer();
            clearInterval(mainInterval);
        });
    },
});
