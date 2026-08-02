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
import { createStorageListener } from "@/utils/bilibili";
import { BiliVideoConfig } from "@/types/types";

import { VideoUI } from "@/components/VideoUI";
import { formatTime, toSeconds } from "@/utils/commonUse";

// TODO 2. popup图标要更据状态显示不同图标。

// TODO 3. 新增样式选择，给用户选择不同的UI样式，需要完成 - 设置时间如同老方法显示在页面上。

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const { config, setConfig, initFromStorage } =
            useStorageConfig();

        const [isAnalyzing, setIsAnalyzing] = createSignal(false);

        // ---------- 2. 工具函数 ----------
       

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
            lastJumpTime = 0;
            resetFrameAnalyzer();
            setIsAnalyzing(false);
        });

        // 注册监听 storage 储存变化
        browser.storage.onChanged.addListener(storageListener);

        browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === "GET_PAGE_CONFIG") {
                sendResponse({ received: true });
                return true; 
            }
        });


        // ---------- 4. UI 挂载 ----------

        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: () => {
                // 动态返回当前锚点
                return (
                   document.getElementById(TARGET_ID) as HTMLElement
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
                BTN_CLASS,
            ) as HTMLElement;
            if (nextBtn) {
                lastJumpTime = now;
                nextBtn.click();
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
        ctx.setInterval(async () => {
            try {
                // 7.1 判断是否合集页
                const isCol = !!document.querySelector(".video-pod");

                const runControl =
                    isCol && config.isAutoHandle;
                // 7.4 更新 ready 状态
                if (runControl !== lastPageState) {
                    lastPageState = runControl;
                    await browser.storage.local.set({
                        isPageReady: runControl,
                    });
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

        browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.type === "PING") {
                sendResponse({ alive: lastPageState });
                return true;
            }
            return false;
        });

        // ---------- 10. 清理 ----------
        ctx.onInvalidated(() => {
            browser.storage.onChanged.removeListener(storageListener);
            document.getElementById("bili-skip-wrapper-unique")?.remove();
            destroyFrameAnalyzer();
        });
    },
});
