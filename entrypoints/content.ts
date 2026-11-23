// entrypoints/content.ts
// 内容脚本：原生 DOM + 直接读写 storage，不依赖 SolidJS
import { browser } from "wxt/browser";
import {
    getBvidFromUrl,
    getMainVideo,
    TARGET_ID,
    BTN_CLASS,
} from "@/utils/bilibili";
import { loadSegments, parseCreatedSegments, pickNextSegment, saveSegments } from "@/utils/segments";
import type {
    ActionButtonsHandle,
    ApiSegment,
    ContentConfig,
    JumpPanelHandle,
    JumpPanelSubmitPayload,
    JumpPanelTab,
    SkipSegment,
    SubmitResult,
    UiVisibility,
    VideoUIHandle,
} from "@/types/types";
import { createActionButtons, createVideoUI } from "@/utils/videoUI";
import { createJumpPanel } from "@/utils/jumpPanel";
import {
    DEFAULT_UI,
    isUiEmpty,
    normalizeUi,
    UI_STORAGE_KEY,
} from "@/utils/uiVisibility";

const DEFAULT_CONFIG: ContentConfig = { segments: [], useCloudSegments: true };

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        // ---------- 1. 配置：片段列表统一存在 storage.segments ----------
        let config: ContentConfig = {
            ...DEFAULT_CONFIG,
            segments: [],
        };
        let uiHandle: VideoUIHandle | null = null;
        let actionsHandle: ActionButtonsHandle | null = null;
        let panel: JumpPanelHandle | null = null;
        let panelHost: HTMLElement | null = null;
        let previewRule: SkipSegment | null = null;
        /** 状态那一行的显示开关（只影响显示） */
        let uiVisibility: UiVisibility = { ...DEFAULT_UI };

        // ---------- popup：请求打开浮动窗口（片段查看 / 片段设置） ----------
        /** ok = 已打开；no-host = 播放器容器还没就绪；not-collection = 当前页不是合集 */
        type OpenPanelResult = "ok" | "no-host" | "not-collection";

        /** openPanel 还没定义时收到的请求先挂起，定义完成后补开 */
        let openPanelImpl: ((tab: JumpPanelTab) => OpenPanelResult) | null = null;
        let pendingPanelTab: JumpPanelTab | null = null;

        const messageListener = (message: any, sender: any, sendResponse: any) => {
            // 只接受本扩展自己的上下文
            if (sender?.id !== browser.runtime.id) return;
            if (!message || message.type !== "OPEN_PANEL") return;

            const tab: JumpPanelTab =
                message.data?.tab === "submit" ? "submit" : "view";

            if (!openPanelImpl) {
                pendingPanelTab = tab;
                sendResponse({ ok: true });
                return;
            }

            const result = openPanelImpl(tab);
            sendResponse({
                ok: result === "ok",
                reason: result === "ok" ? undefined : result,
            });
        };
        browser.runtime.onMessage.addListener(messageListener);

        /** 云端片段映射成统一片段（仅用于播放判断） */
        let cloudSegments: SkipSegment[] = [];
        let cloudKey = "";
        let cloudRetryAt = 0;
        /** 云端请求序号：换 P / 换视频后丢弃迟到的旧响应 */
        let cloudRequestSeq = 0;
        /** 刚上传、服务端可能还没返回的片段，先本地生效 */
        let optimisticSegments: SkipSegment[] = [];
        let optimisticUntil = 0;

        const CLOUD_SKIP_CATEGORIES = new Set(["intro", "sponsor", "selfpromo"]);

        const getVideo = () => getMainVideo();

        const currentDuration = () => {
            const duration = getVideo()?.duration ?? 0;
            return Number.isFinite(duration) ? duration : 0;
        };

        /** 状态条需要同时感知手动/云端片段、视频时长和显示开关，统一走这里更新 */
        const syncUi = () => {
            uiHandle?.update(
                config,
                uiVisibility,
                cloudSegments,
                currentDuration(),
            );
            actionsHandle?.update(uiVisibility);
        };

        const loadConfig = async () => {
            const stored = await browser.storage.local.get({
                useCloudSegments: true,
                [UI_STORAGE_KEY]: DEFAULT_UI,
            });

            config = {
                segments: await loadSegments(),
                useCloudSegments: stored.useCloudSegments !== false,
            };
            uiVisibility = normalizeUi(stored[UI_STORAGE_KEY]);

            if (!config.useCloudSegments) {
                cloudRequestSeq += 1;
                cloudSegments = [];
                cloudKey = "";
                cloudRetryAt = 0;
                optimisticSegments = [];
                optimisticUntil = 0;
            }

            syncUi();
            panel?.update(config);
        };

        /** 拉取云端片段并按类别映射成 skip / next */
        const loadCloudSegments = async (force = false): Promise<SkipSegment[]> => {
            const requestSeq = ++cloudRequestSeq;

            if (!config.useCloudSegments) {
                cloudSegments = [];
                return [];
            }

            const bvid = getBvidFromUrl(location.href);
            const video = getVideo();
            if (!bvid || !video) {
                cloudSegments = [];
                return [];
            }

            try {
                const result = (await browser.runtime.sendMessage({
                    type: "SB_LOOKUP",
                    data: {
                        bvid,
                        page:
                            Number(
                                new URL(location.href).searchParams.get("p"),
                            ) || 1,
                        force,
                    },
                })) as { ok?: boolean; segments?: ApiSegment[] } | undefined;

                // 换 P / 换视频后，迟到的旧响应不再覆盖当前状态
                if (requestSeq !== cloudRequestSeq) return [];

                if (!result?.ok || !Array.isArray(result.segments)) {
                    // 失败（网络/服务端）5 秒后重试；保留现有片段（含乐观合并）
                    cloudKey = "";
                    cloudRetryAt = Date.now() + 5000;
                    return [];
                }

                cloudRetryAt = 0;
                const duration = video.duration;

                let mapped = result.segments
                    .filter((segment) => segment.actionType === "skip")
                    .filter(
                        (segment) =>
                            segment.videoDuration <= 0 ||
                            !Number.isFinite(duration) ||
                            Math.abs(segment.videoDuration - duration) <= 2,
                    )
                    .flatMap((segment): SkipSegment[] => {
                        const kind =
                            segment.category === "outro"
                                ? "next"
                                : CLOUD_SKIP_CATEGORIES.has(segment.category)
                                  ? "skip"
                                  : null;

                        if (!kind) return [];

                        return [
                            {
                                id: segment.id,
                                start: segment.start,
                                end: segment.end,
                                kind,
                                source: "api",
                            },
                        ];
                    });

                // 服务端可能还没返回刚上传的片段，2 分钟内先本地补上
                if (
                    Date.now() < optimisticUntil &&
                    optimisticSegments.length > 0
                ) {
                    const ids = new Set(mapped.map((item) => item.id));
                    const missing = optimisticSegments.filter(
                        (item) => !ids.has(item.id),
                    );

                    if (missing.length === 0) {
                        optimisticSegments = [];
                        optimisticUntil = 0;
                    } else {
                        mapped = [...mapped, ...missing];
                    }
                } else {
                    optimisticSegments = [];
                    optimisticUntil = 0;
                }

                cloudSegments = mapped;
                return mapped;
            } catch {
                if (requestSeq !== cloudRequestSeq) return [];
                cloudKey = "";
                cloudRetryAt = Date.now() + 5000;
                return [];
            }
        };

        await loadConfig();

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

        /** 新增 / 更新一个手动片段（下一P 全局只保留一个） */
        const saveSegment = async (segment: SkipSegment) => {
            const next = config.segments.filter(
                (item) =>
                    item.id !== segment.id &&
                    !(segment.kind === "next" && item.kind === "next"),
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
            const page = Number(
                new URL(location.href).searchParams.get("p"),
            ) || 1;

            const result = (await browser.runtime.sendMessage({
                type: "SB_SUBMIT",
                data: { ...payload, page },
            })) as SubmitResult | undefined;

            return result ?? { ok: false, reason: "network" };
        };

        /** 上传成功：先把新片段并入云端规则，等刷新结果再校正 */
        const handleUploaded = (created: unknown) => {
            const parsed = parseCreatedSegments(created);
            if (parsed.length === 0) return;

            optimisticSegments = [
                ...optimisticSegments.filter(
                    (item) => !parsed.some((added) => added.id === item.id),
                ),
                ...parsed,
            ];
            optimisticUntil = Date.now() + 2 * 60 * 1000;

            const ids = new Set(parsed.map((item) => item.id));
            cloudSegments = [
                ...cloudSegments.filter((item) => !ids.has(item.id)),
                ...parsed,
            ];

            syncUi();
        };

        /** 供面板手动刷新云端片段 */
        const refreshCloudSegments = async (
            force = false,
        ): Promise<SkipSegment[]> => {
            await loadCloudSegments(force);
            syncUi();
            return cloudSegments;
        };

        /**
         * 打开浮动窗口（挂到 #playerWrap 内；容器被替换时自动重建）
         */
        const openPanel = (tab: JumpPanelTab): OpenPanelResult => {
            // 插件只在合集页生效，非合集页没有状态条，也不弹面板
            if (!document.querySelector(".video-pod")) {
                return "not-collection";
            }

            const host = document.getElementById("playerWrap");
            if (!host) {
                console.warn("[BMC] 未找到 #playerWrap，浮动窗口无法打开");
                return "no-host";
            }

            if (!panel || panelHost !== host) {
                panel?.destroy();
                panel = createJumpPanel(host, config, {
                    onSubmit: submitSegments,
                    onUploaded: handleUploaded,
                    onRefreshCloud: refreshCloudSegments,
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
            return "ok";
        };

        openPanelImpl = openPanel;

        /** 从状态条打开「云端片段」数据页，并带上当前 BV / 分P */
        const openCloudPage = () => {
            const bvid = getBvidFromUrl(location.href);
            if (!bvid) return;

            const page =
                Number(new URL(location.href).searchParams.get("p")) || 1;

            void browser.runtime.sendMessage({
                type: "OPEN_CLOUD_PAGE",
                data: { bvid, page },
            });
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

        /**
         * B 站顶栏会先从骨架 .mini-header 切换成完整的 .bili-header--mini；
         * 在切换完成前往页面里插节点，会让它的 mount 报 nextSibling 为 null，
         * 结果整个顶部导航条消失。这里等切换完成（或超时兜底）再挂插件 UI。
         */
        const waitForBiliHeaderReady = (timeout = 8000) =>
            new Promise<void>((resolve) => {
                const ready = () =>
                    !!document.querySelector(
                        ".bili-header--mini, .bili-header__menu",
                    );

                if (ready()) {
                    resolve();
                    return;
                }

                let done = false;
                let observer: MutationObserver | null = null;
                let timer: ReturnType<typeof setTimeout> | null = null;

                const finish = () => {
                    if (done) return;
                    done = true;
                    observer?.disconnect();
                    if (timer) clearTimeout(timer);
                    resolve();
                };

                observer = new MutationObserver(() => {
                    if (ready()) finish();
                });
                observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                });
                timer = setTimeout(finish, timeout);
            });

        // ---------- 3. UI 挂载（原生 DOM） ----------
        let uiMounted = false;
        /** B 站顶栏切换完成前不插 DOM，避免影响页面自身渲染 */
        let biliHeaderReady = false;

        void waitForBiliHeaderReady().then(() => {
            // 再给顶栏一点稳定时间，然后才允许插入状态条
            setTimeout(() => {
                biliHeaderReady = true;
            }, 300);
        });

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

                uiHandle = createVideoUI(left, openCloudPage);
                syncUi();

                actionsHandle = createActionButtons(
                    right,
                    {
                        onView: () => openPanel("view"),
                        onSubmit: () => openPanel("submit"),
                    },
                    uiVisibility,
                );

                return () => {
                    actionsHandle?.destroy();
                    actionsHandle = null;
                    uiHandle?.destroy();
                    uiHandle = null;
                };
            },
            onRemove: (unmount) => unmount?.(),
        });

        /** 只有「合集页 + 至少一个可见项」才挂载；整行不可见时不留空白 */
        const updateUi = (isCollection: boolean) => {
            const shouldMount = isCollection && !isUiEmpty(uiVisibility);

            // 页面容器被 SPA 替换时，wrapper 会脱离 DOM；此时重新挂载
            if (
                shouldMount &&
                biliHeaderReady &&
                (!uiMounted || !ui.wrapper.isConnected)
            ) {
                if (uiMounted) {
                    ui.remove();
                    uiMounted = false;
                }
                ui.mount();
                uiMounted = true;
            } else if (!shouldMount && uiMounted) {
                ui.remove();
                uiMounted = false;
            }

            // 只有离开合集页才清理浮动窗口；「全部隐藏」时 Popup 仍可打开面板
            if (!isCollection) {
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

            // 手动片段优先：与手动片段重叠的云端片段直接忽略
            const cloud = config.useCloudSegments
                ? cloudSegments.filter(
                      (segment) =>
                          !config.segments.some(
                              (item) =>
                                  segment.start < item.end &&
                                  segment.end > item.start,
                          ),
                  )
                : [];

            const effective = [...config.segments, ...cloud];

            // 片段跳过
            for (const segment of effective) {
                if (segment.kind !== "skip") continue;
                if (cur >= segment.start && cur < segment.end) {
                    video.currentTime = Math.min(
                        segment.end,
                        video.duration || segment.end,
                    );
                    return;
                }
            }

            // 到点切换下一 P：手动 next 优先；没有手动时云端只取 start 最大的一条
            const nextSegment = pickNextSegment(
                config.segments,
                cloud,
                video.duration,
            );
            if (nextSegment && cur >= nextSegment.start) {
                executeJump();
                return;
            }
        };

        // ---------- 6. 主循环 ----------
        const mainLoop = () => {
            try {
                const video = getVideo();

                // 视频时长就绪后拉一次云端片段（换 P / 换视频会因 key 变化重拉）
                if (
                    config.useCloudSegments &&
                    video &&
                    video.readyState >= 2 &&
                    video.duration > 0
                ) {
                    const bvid = getBvidFromUrl(location.href);
                    const page =
                        Number(new URL(location.href).searchParams.get("p")) ||
                        1;
                    const key = bvid
                        ? `${bvid}:${page}:${Math.round(video.duration)}`
                        : "";

                    if (key && key !== cloudKey && Date.now() >= cloudRetryAt) {
                        cloudKey = key;
                        void loadCloudSegments().finally(() => {
                            syncUi();
                        });
                    }
                }

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
            if (
                !changes.segments &&
                !changes.useCloudSegments &&
                !changes[UI_STORAGE_KEY]
            ) {
                return;
            }

            void loadConfig().then(() => {
                // 显示开关变化要立即生效：重新判断是否还有可见内容
                updateUi(!!document.querySelector(".video-pod"));
            });
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
            cloudRequestSeq += 1;
            cloudSegments = [];
            cloudKey = "";
            optimisticSegments = [];
            optimisticUntil = 0;
            syncUi();

            // 换 P / 换视频后 playerWrap 可能被替换，窗口留给下次重新创建
            panel?.destroy();
            panel = null;
            panelHost = null;
        };
        ctx.addEventListener(window, "wxt:locationchange", locationChangeHandler);

        // ---------- 8. 启动 ----------
        await waitForElement(`#${TARGET_ID}`);

        /** 页面就绪前收到过 popup 的打开请求：等 #playerWrap 挂好再补开 */
        const flushPendingPanel = (retries = 10): void => {
            if (!pendingPanelTab) return;

            if (openPanel(pendingPanelTab) === "ok") {
                pendingPanelTab = null;
                return;
            }

            if (retries > 0) {
                ctx.setTimeout(() => flushPendingPanel(retries - 1), 300);
            }
        };
        flushPendingPanel();

        ctx.setInterval(mainLoop, 200);

        // ---------- 9. 清理 ----------
        // ctx.addEventListener / ctx.setInterval 由 WXT 在失效时自动清理；
        // browser.* 上的监听需要手动移除。
        ctx.onInvalidated(() => {
            browser.storage.onChanged.removeListener(storageListener);
            browser.runtime.onMessage.removeListener(messageListener);
            panel?.destroy();
            panel = null;
            panelHost = null;
            updateUi(false);
        });
    },
});
