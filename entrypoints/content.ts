// entrypoints/content.ts
// 内容脚本：原生 DOM + 直接读写 storage，不依赖 SolidJS
import { browser } from "wxt/browser";
import {
    getMainVideo,
    toSeconds,
    TARGET_ID,
    BTN_CLASS,
} from "@/utils/bilibili";
import type {
    ContentConfig,
    JumpPanelHandle,
    JumpPanelTab,
    TimePoint,
    TimeRange,
    VideoUIHandle,
} from "@/types/types";
import { createActionButtons, createVideoUI } from "@/utils/videoUI";
import { createJumpPanel } from "@/utils/jumpPanel";

const DEFAULT_CONFIG: ContentConfig = {
    opRanges: [],
    jumpConfig: { h: 0, m: 0, s: 0 },
};

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        // ---------- 1. 配置：直接读 storage，变更由 storage.onChanged 通知 ----------
        let config: ContentConfig = { ...DEFAULT_CONFIG };
        let uiHandle: VideoUIHandle | null = null;
        let panel: JumpPanelHandle | null = null;
        let panelHost: HTMLElement | null = null;

        const loadConfig = async () => {
            const stored = await browser.storage.local.get({
                opRanges: [],
                jumpConfig: { h: 0, m: 0, s: 0 },
            });

            config = {
                opRanges: (stored.opRanges as TimeRange[]) ?? [],
                jumpConfig:
                    (stored.jumpConfig as TimePoint) ?? DEFAULT_CONFIG.jumpConfig,
            };

            uiHandle?.update(config);
            panel?.update(config);
        };

        await loadConfig();

        /**
         * 打开浮动窗口（挂到 #playerWrap 内；容器被替换时自动重建）
         */
        const openPanel = (tab: JumpPanelTab) => {
            const host = document.getElementById("playerWrap");
            if (!host) {
                console.warn("[BMC] 未找到 #playerWrap，浮动窗口无法打开");
                return;
            }

            if (!panel || panelHost !== host) {
                panel?.destroy();
                panel = createJumpPanel(host, config);
                panelHost = host;
            }

            panel.open(tab);
        };

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

        // ---------- 3. UI 挂载（原生 DOM） ----------
        let uiMounted = false;
        const ui = createIntegratedUi(ctx, {
            position: "inline",
            anchor: () => document.getElementById(TARGET_ID) as HTMLElement,
            onMount: (container) => {
                // 一行两段：左侧状态条，右侧操作按钮
                const row = document.createElement("div");
                row.style.cssText =
                    "display:flex;align-items:center;justify-content:space-between;" +
                    "gap:12px;width:100%;";

                const left = document.createElement("div");
                left.style.cssText =
                    "display:inline-flex;align-items:center;min-width:0;";

                const right = document.createElement("div");
                right.style.cssText =
                    "display:inline-flex;align-items:center;gap:8px;";

                row.append(left, right);
                container.append(row);

                uiHandle = createVideoUI(left);
                uiHandle.update(config);

                const actions = createActionButtons(right, {
                    onView: () => openPanel("view"),
                    onSubmit: () => openPanel("submit"),
                });

                return () => {
                    actions.destroy();
                    uiHandle?.destroy();
                    uiHandle = null;
                };
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

                panel?.destroy();
                panel = null;
                panelHost = null;
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

        // ---------- 5. 核心控制逻辑 ----------
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

            // 切集：到达设定时间点后点击「下一 P」
            const jumpTime = toSeconds(config.jumpConfig);
            if (jumpTime > 0 && cur >= jumpTime) {
                executeJump();
            }
        };

        // ---------- 6. 主循环 ----------
        const mainLoop = () => {
            try {
                const isCol = !!document.querySelector(".video-pod");
                updateUi(isCol);
                if (isCol) runControlLogic();
            } catch (e) {
                console.error("[Main Loop] 异常:", e);
            }
        };

        // ---------- 7. 事件监听 ----------
        // popup / options 写入 storage 后，浏览器通过 onChanged 通知到这里
        const storageListener = (changes: any, area: string) => {
            if (area !== "local") return;
            if (!changes.opRanges && !changes.jumpConfig) return;
            void loadConfig();
        };
        browser.storage.onChanged.addListener(storageListener);

        // 页面 URL 变化
        const locationChangeHandler = (event: Event) => {
            const newUrl =
                (event as CustomEvent).detail?.newUrl || (event as any).newUrl;
            if (!newUrl) return;
            lastJumpTime = 0;

            // 换 P / 换视频后 playerWrap 可能被替换，窗口留给下次重新创建
            panel?.destroy();
            panel = null;
            panelHost = null;
        };
        ctx.addEventListener(window, "wxt:locationchange", locationChangeHandler);

        // ---------- 8. 启动 ----------
        await waitForElement(TARGET_ID);

        ctx.setInterval(mainLoop, 200);

        // ---------- 9. 清理 ----------
        // ctx.addEventListener / ctx.setInterval 由 WXT 在失效时自动清理；
        // browser.* 上的监听需要手动移除。
        ctx.onInvalidated(() => {
            browser.storage.onChanged.removeListener(storageListener);
            panel?.destroy();
            panel = null;
            panelHost = null;
            updateUi(false);
        });
    },
});
