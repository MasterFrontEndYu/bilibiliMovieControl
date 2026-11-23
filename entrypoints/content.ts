// entrypoints/content.ts
// 内容脚本：配置 / 播放逻辑用原生 JS，界面用 Solid 1 渲染（手写 CSS，不引入 Tailwind）
import { render } from "solid-js/web";
import { browser } from "wxt/browser";
import {
    getBvidFromUrl,
    getMainVideo,
    TARGET_ID,
    BTN_CLASS,
} from "@/utils/bilibili";
import {
    effectiveCloudSegments,
    loadSegments,
    normalizeSegments,
    parseCreatedSegments,
    pickNextSegment,
    saveSegments,
} from "@/utils/segments";
import type {
    ApiSegment,
    JumpPanelSubmitPayload,
    JumpPanelTab,
    SkipSegment,
    SubmitResult,
    UiVisibility,
} from "@/types/types";
import { StatusRow } from "@/content-ui/StatusRow";
import { JumpPanel } from "@/content-ui/JumpPanel";
import {
    removeProgressMarkers,
    syncProgressMarkers,
} from "@/content-ui/progressMarkers";
import {
    closePanelState,
    openPanelState,
    updateUiData,
} from "@/content-ui/state";
import {
    DEFAULT_UI,
    hasVisibleRow,
    normalizeUi,
    UI_STORAGE_KEY,
} from "@/utils/uiVisibility";
import {
    createDefaultConfig,
    DEFAULT_USE_CLOUD_SEGMENTS,
} from "@/utils/configDefaults";

export default defineContentScript({
    matches: ["*://*.bilibili.com/video/*"],
    cssInjectionMode: "manual",

    async main(ctx) {
        // ---------- 1. 配置：片段列表统一存在 storage.segments ----------
        let config = createDefaultConfig();
        let previewRule: SkipSegment | null = null;
        /** 状态那一行的显示开关（只影响显示） */
        let uiVisibility: UiVisibility = { ...DEFAULT_UI };

        /** 浮动窗口的 Solid 挂载点（#playerWrap 内的 display:contents 容器） */
        let panelHostEl: HTMLElement | null = null;
        let panelDispose: (() => void) | null = null;

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

        /** 换视频 / 关闭云端时清空所有云端状态（含重试时间） */
        const resetCloudState = () => {
            cloudRequestSeq += 1;
            cloudSegments = [];
            cloudKey = "";
            cloudRetryAt = 0;
            optimisticSegments = [];
            optimisticUntil = 0;
        };

        const CLOUD_SKIP_CATEGORIES = new Set(["intro", "sponsor", "selfpromo"]);

        const currentDuration = () => {
            const duration = getMainVideo()?.duration ?? 0;
            return Number.isFinite(duration) ? duration : 0;
        };

        /** 当前页是否为带选集列表的合集页（插件只在这里生效） */
        const isCollectionPage = () => !!document.querySelector(".video-pod");

        /** 当前视频的 BV 与分 P（URL 里 p 缺省为 1） */
        const currentVideoRef = () => {
            const page =
                Number(new URL(location.href).searchParams.get("p")) || 1;
            return { bvid: getBvidFromUrl(location.href), page };
        };

        /** 状态条需要同时感知手动/云端片段、视频时长和显示开关，统一走这里更新 */
        const syncUi = () => {
            updateUiData({
                config,
                ui: uiVisibility,
                cloudSegments,
                duration: currentDuration(),
            });
        };

        const loadConfig = async () => {
            const stored = await browser.storage.local.get({
                useCloudSegments: DEFAULT_USE_CLOUD_SEGMENTS,
                [UI_STORAGE_KEY]: DEFAULT_UI,
            });

            config = {
                segments: await loadSegments(),
                useCloudSegments: stored.useCloudSegments !== false,
            };
            uiVisibility = normalizeUi(stored[UI_STORAGE_KEY]);

            if (!config.useCloudSegments) {
                resetCloudState();
            }

            syncUi();
        };

        /** 拉取云端片段并按类别映射成 skip / next */
        const loadCloudSegments = async (force = false): Promise<SkipSegment[]> => {
            const requestSeq = ++cloudRequestSeq;

            if (!config.useCloudSegments) {
                cloudSegments = [];
                return [];
            }

            const { bvid, page } = currentVideoRef();
            const video = getMainVideo();
            if (!bvid || !video) {
                cloudSegments = [];
                return [];
            }

            try {
                const result = (await browser.runtime.sendMessage({
                    type: "SB_LOOKUP",
                    data: { bvid, page, force },
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
            const video = getMainVideo();
            if (!video) return;

            video.pause();
            video.currentTime = Math.max(0, seconds);
            manualSeekGuardUntil = Date.now() + 2000;
        };

        /** 预览：跳到片段前 3 秒播放，并在到达起点时临时执行一次 */
        const previewSegment = (segment: SkipSegment) => {
            const video = getMainVideo();
            if (!video) return;

            manualSeekGuardUntil = 0;
            previewRule = { ...segment };
            video.currentTime = Math.max(0, segment.start - 3);
            void video.play()?.catch(() => undefined);
        };

        /** 保存片段并同步内存状态（写路径不重读 storage） */
        const persistSegments = async (next: SkipSegment[]) => {
            config = {
                ...config,
                segments: await saveSegments(next),
            };
            syncUi();
        };

        /** 新增 / 更新一个手动片段（下一P 全局只保留一个） */
        const saveSegment = async (segment: SkipSegment) => {
            const next = config.segments.filter(
                (item) =>
                    item.id !== segment.id &&
                    !(segment.kind === "next" && item.kind === "next"),
            );
            next.push(segment);

            await persistSegments(next);
        };

        const deleteSegment = async (id: string) => {
            await persistSegments(
                config.segments.filter((item) => item.id !== id),
            );
        };

        /** 提交片段：转交 background 发起 POST /api/skipSegments */
        const submitSegments = async (
            payload: JumpPanelSubmitPayload,
        ): Promise<SubmitResult> => {
            const { page } = currentVideoRef();

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

        /** 清理浮动窗口（离开合集页 / 换 P / 脚本失效时） */
        const disposePanel = () => {
            panelDispose?.();
            panelDispose = null;
            panelHostEl?.remove();
            panelHostEl = null;
        };

        /** 关闭面板：卸载 DOM + 复位打开状态 */
        const closePanel = () => {
            disposePanel();
            closePanelState();
        };

        /**
         * 确保浮动窗口已挂载到当前 #playerWrap 内（容器被 SPA 替换时重建）。
         */
        const ensurePanel = (wrap: HTMLElement) => {
            if (panelHostEl && panelHostEl.parentElement === wrap) return;

            disposePanel();

            const host = document.createElement("div");
            host.style.display = "contents";
            wrap.append(host);
            panelHostEl = host;

            panelDispose = render(
                () =>
                    JumpPanel({
                        container: wrap,
                        onSubmit: submitSegments,
                        onUploaded: handleUploaded,
                        onRefreshCloud: refreshCloudSegments,
                        onSaveSegment: saveSegment,
                        onDeleteSegment: deleteSegment,
                        onSeek: seekTo,
                        onPreview: previewSegment,
                        getCurrentTime: () => getMainVideo()?.currentTime ?? 0,
                        getDuration: () => currentDuration(),
                    }),
                host,
            );
        };

        /**
         * 打开浮动窗口（挂到 #playerWrap 内；容器被替换时自动重建）
         */
        const openPanel = (tab: JumpPanelTab): OpenPanelResult => {
            // 插件只在合集页生效，非合集页没有状态条，也不弹面板
            if (!isCollectionPage()) {
                return "not-collection";
            }

            const wrap = document.getElementById("playerWrap");
            if (!wrap) {
                console.warn("[BMC] 未找到 #playerWrap，浮动窗口无法打开");
                return "no-host";
            }

            ensurePanel(wrap);
            openPanelState(tab);
            return "ok";
        };

        openPanelImpl = openPanel;

        /** 从状态条打开「云端片段」数据页，并带上当前 BV / 分P */
        const openCloudPage = () => {
            const { bvid, page } = currentVideoRef();
            if (!bvid) return;

            void browser.runtime.sendMessage({
                type: "OPEN_CLOUD_PAGE",
                data: { bvid, page },
            });
        };

        // ---------- 2. 工具函数：等待元素出现 ----------
        /**
         * 轮询 DOM，直到 probe 返回真值或超时。
         * 元素探测和顶栏就绪判断共用这一套 MutationObserver + 超时兜底。
         */
        const waitFor = <T>(
            probe: () => T | false | null | undefined,
            timeout = 10000,
            observe: MutationObserverInit = {
                childList: true,
                subtree: true,
            },
        ) =>
            new Promise<T | null>((resolve) => {
                const immediate = probe();
                if (immediate) {
                    resolve(immediate);
                    return;
                }

                let done = false;
                const observer = new MutationObserver(() => {
                    const value = probe();
                    if (value) finish(value);
                });
                const timer = setTimeout(() => finish(null), timeout);

                function finish(value: T | null) {
                    if (done) return;
                    done = true;
                    observer.disconnect();
                    clearTimeout(timer);
                    resolve(value);
                }

                observer.observe(document.body, observe);
            });

        const waitForElement = (selector: string, timeout = 10000) =>
            waitFor(() => document.querySelector(selector), timeout);

        /**
         * B 站顶栏会先从骨架 .mini-header 切换成完整的 .bili-header--mini；
         * 在切换完成前往页面里插节点，会让它的 mount 报 nextSibling 为 null，
         * 结果整个顶部导航条消失。这里等切换完成（或超时兜底）再挂插件 UI。
         */
        const waitForBiliHeaderReady = (timeout = 8000) =>
            waitFor(
                () =>
                    !!document.querySelector(
                        ".bili-header--mini, .bili-header__menu",
                    ),
                timeout,
                { childList: true, subtree: true, attributes: true },
            ).then(() => undefined);

        // ---------- 3. UI 挂载（原生 DOM） ----------
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
                const dispose = render(
                    () =>
                        StatusRow({
                            onOpenCloud: openCloudPage,
                            onView: () => openPanel("view"),
                            onOpenSubmit: () => openPanel("submit"),
                        }),
                    container,
                );

                syncUi();

                return () => {
                    dispose();
                };
            },
            onRemove: (unmount) => unmount?.(),
        });

        /** 只有「合集页 + 至少一个可见行项目」才挂载；整行不可见时不留空白 */
        const updateUi = (isCollection: boolean) => {
            const shouldMount = isCollection && hasVisibleRow(uiVisibility);
            const mounted = ui.mounted !== undefined;

            // 页面容器被 SPA 替换时，wrapper 会脱离 DOM；此时重新挂载
            if (
                shouldMount &&
                biliHeaderReady &&
                (!mounted || !ui.wrapper.isConnected)
            ) {
                if (mounted) ui.remove();
                ui.mount();
            } else if (!shouldMount && mounted) {
                ui.remove();
            }

            // 只有离开合集页才清理浮动窗口；「全部隐藏」时 Popup 仍可打开面板
            if (!isCollection) {
                closePanel();
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
            const video = getMainVideo();
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
                ? effectiveCloudSegments(config.segments, cloudSegments)
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
        let lastIsCollection: boolean | null = null;
        let tick = 0;

        const mainLoop = () => {
            try {
                const video = getMainVideo();

                // 视频时长就绪后拉一次云端片段（换 P / 换视频会因 key 变化重拉）
                if (
                    config.useCloudSegments &&
                    video &&
                    video.readyState >= 2 &&
                    video.duration > 0
                ) {
                    const { bvid, page } = currentVideoRef();
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

                const isCol = isCollectionPage();
                const collectionChanged = isCol !== lastIsCollection;
                lastIsCollection = isCol;
                tick += 1;

                // UI 挂载状态不必每 200ms 检查：集合页变化时立即处理，
                // 其余情况每秒探测一次（应对 SPA 替换 #viewbox_report）。
                if (collectionChanged || (isCol && tick % 5 === 0)) {
                    updateUi(isCol);
                }

                if (isCol) {
                    syncProgressMarkers(currentDuration());
                    runControlLogic();
                } else {
                    removeProgressMarkers();
                }
            } catch (e) {
                console.error("[Main Loop] 异常:", e);
            }
        };

        // ---------- 7. 事件监听 ----------
        // popup / options 写入 storage 后，浏览器通过 onChanged 通知到这里
        const storageListener = (changes: any, area: string) => {
            if (area !== "local") return;

            if (changes[UI_STORAGE_KEY]) {
                uiVisibility = normalizeUi(changes[UI_STORAGE_KEY].newValue);
                syncUi();
                updateUi(isCollectionPage());
            }

            if (changes.segments) {
                // 片段只在本上下文写入；直接同步内存，不再重读 storage
                config = {
                    ...config,
                    segments: normalizeSegments(changes.segments.newValue),
                };
                syncUi();
            }

            if (changes.useCloudSegments) {
                void loadConfig().then(() => updateUi(isCollectionPage()));
            }
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
            resetCloudState();
            syncUi();

            // 换 P / 换视频后 playerWrap 可能被替换，窗口留给下次重新创建
            closePanel();
        };
        ctx.addEventListener(window, "wxt:locationchange", locationChangeHandler);

        // ---------- 8. 启动 ----------
        const target = await waitForElement(`#${TARGET_ID}`);
        if (!target) {
            console.warn(
                "[BMC] 未找到 #viewbox_report，状态条可能无法挂载",
            );
        }

        /** 页面就绪前收到过 popup 的打开请求：等 #playerWrap 挂好再补开 */
        const flushPendingPanel = (retries = 10): void => {
            if (!pendingPanelTab) return;

            const result = openPanel(pendingPanelTab);

            if (result === "ok") {
                pendingPanelTab = null;
                return;
            }

            // 非合集页重试也不会成功，直接放弃
            if (result === "not-collection") {
                pendingPanelTab = null;
                return;
            }

            if (retries > 0) {
                ctx.setTimeout(() => flushPendingPanel(retries - 1), 300);
            } else {
                pendingPanelTab = null;
            }
        };
        flushPendingPanel();

        ctx.setInterval(mainLoop, 200);

        // ---------- 9. 清理 ----------
        // ctx.addEventListener / ctx.setInterval / 状态条 UI 由 WXT 在失效时自动清理；
        // browser.* 上的监听需要手动移除。
        ctx.onInvalidated(() => {
            browser.storage.onChanged.removeListener(storageListener);
            browser.runtime.onMessage.removeListener(messageListener);
            closePanel();
            removeProgressMarkers();
        });
    },
});
