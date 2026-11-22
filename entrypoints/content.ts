// entrypoints/content.ts
// 内容脚本：原生 DOM + 直接读写 storage，不依赖 SolidJS
import { browser } from "wxt/browser";
import { getMainVideo, TARGET_ID, BTN_CLASS } from "@/utils/bilibili";
import { loadSegments, saveSegments } from "@/utils/segments";
import type {
    ContentConfig,
    JumpPanelHandle,
    JumpPanelSubmitPayload,
    JumpPanelTab,
    SkipSegment,
    SubmitResult,
    VideoUIHandle,
} from "@/types/types";
import { createActionButtons, createVideoUI } from "@/utils/videoUI";
import { createJumpPanel } from "@/utils/jumpPanel";

const DEFAULT_CONFIG: ContentConfig = { segments: [] };

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        // ---------- 1. 配置：片段列表统一存在 storage.segments ----------
        let config: ContentConfig = { ...DEFAULT_CONFIG, segments: [] };
        let uiHandle: VideoUIHandle | null = null;
        let panel: JumpPanelHandle | null = null;
        let panelHost: HTMLElement | null = null;
        let previewRule: SkipSegment | null = null;

        const loadConfig = async () => {
            config = { segments: await loadSegments() };
            uiHandle?.update(config);
            panel?.update(config);
        };

        await loadConfig();

        const getVideo = () => getMainVideo();

        /** 手动定位（开头/结尾）后短暂关闭自动跳转，避免刚定位就被规则带走 */
        let manualSeekGuardUntil = 0;

        const seekTo = (seconds: number) => {
            const video = getVideo();
            if (!video) return;

            video.pause();
            video.currentTime = Math.max(0, seconds);
            manualSeekGuardUntil = Date.now() + 2000;
        };

        /** 预览：跳到片段前 3 秒播放，并在到达起点时临时执行一次 */
        const previewSegment = (segment: SkipSegment) => {
            const video = getVideo();
            if (!video) return;

            manualSeekGuardUntil = 0;
            previewRule = { ...segment };
            video.currentTime = Math.max(0, segment.start - 3);
            void video.play()?.catch(() => undefined);
        };

        /** 新增 / 更新一个手动片段 */
        const saveSegment = async (segment: SkipSegment) => {
            const next = config.segments.filter(
                (item) => item.id !== segment.id,
            );
            next.push(segment);

            await saveSegments(next);
            await loadConfig();
        };

        const deleteSegment = async (id: string) => {
            await saveSegments(
                config.segments.filter((item) => item.id !== id),
            );
            await loadConfig();
        };

        /** 提交片段：转交 background 发起 POST /api/skipSegments */
        const submitSegments = async (
            payload: JumpPanelSubmitPayload,
        ): Promise<SubmitResult> => {
            const result = (await browser.runtime.sendMessage({
                type: "SB_SUBMIT",
                data: payload,
            })) as SubmitResult | undefined;

            return result ?? { ok: false, reason: "network" };
        };

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
                panel = createJumpPanel(host, config, {
                    onSubmit: submitSegments,
                    onSaveSegment: saveSegment,
                    onDeleteSegment: deleteSegment,
                    onSeek: seekTo,
                    onPreview: previewSegment,
                    getCurrentTime: () => getVideo()?.currentTime ?? 0,
                    getDuration: () => {
                        const duration = getVideo()?.duration ?? 0;
                        return Number.isFinite(duration) ? duration : 0;
                    },
                });
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
                previewRule = null;
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
            const video = getVideo();
            if (!video || video.readyState < 2) return;

            // 暂停或刚手动定位时不做自动跳过 / 切集
            if (video.paused || Date.now() < manualSeekGuardUntil) return;

            const cur = video.currentTime;

            // 预览规则优先：到达起点时执行一次后失效
            if (previewRule) {
                if (cur >= previewRule.start) {
                    if (previewRule.kind === "next") {
                        executeJump();
                    } else {
                        video.currentTime = previewRule.end;
                    }
                    previewRule = null;
                }
                return;
            }

            // OP 跳过
            for (const segment of config.segments) {
                if (segment.kind !== "skip") continue;
                if (cur >= segment.start && cur < segment.end) {
                    video.currentTime = segment.end;
                    return;
                }
            }

            // 到点切换下一 P
            for (const segment of config.segments) {
                if (segment.kind !== "next") continue;
                if (segment.start > 0 && cur >= segment.start) {
                    executeJump();
                    return;
                }
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
            if (!changes.segments) return;
            void loadConfig();
        };
        browser.storage.onChanged.addListener(storageListener);

        // 页面 URL 变化
        const locationChangeHandler = (event: Event) => {
            const newUrl =
                (event as CustomEvent).detail?.newUrl || (event as any).newUrl;
            if (!newUrl) return;
            lastJumpTime = 0;
            previewRule = null;
            manualSeekGuardUntil = 0;

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
