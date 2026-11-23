import {
    For,
    Show,
    createEffect,
    createSignal,
    on,
    onCleanup,
    onMount,
} from "solid-js";
import { browser } from "wxt/browser";
import { getBvidFromUrl } from "@/utils/bilibili";
import { effectiveEnd, MIN_SEGMENT_SECONDS } from "@/utils/segments";
import {
    generateUserID,
    MIN_USER_ID_LENGTH,
    USER_ID_STORAGE_KEY,
} from "@/utils/userId";
import { buildSubmitSegments } from "@/utils/jumpPanel";
import { formatSeconds, parseTimeText } from "@/content-ui/time";
import { ensurePanelStyles } from "@/content-ui/panelStyles";
import {
    closePanelState,
    panelOpen,
    panelTab,
    uiState,
} from "@/content-ui/state";
import type {
    JumpPanelHandlers,
    JumpPanelTab,
    SegmentKind,
    SkipSegment,
} from "@/types/types";

export interface JumpPanelProps extends JumpPanelHandlers {
    /** #playerWrap：拖拽边界 */
    container: HTMLElement;
}

const KIND_LABELS: Record<SegmentKind, string> = {
    skip: "片段跳过",
    next: "下一P",
};

const REASON_TEXT: Record<string, string> = {
    "bad-bvid": "视频 BV 号无效",
    "bad-request": "上传参数不完整",
    "bad-json": "接口返回数据异常",
    rejected: "上传被服务端拒绝（403）",
    duplicate: "这段内容已经上传过（409）",
    "rate-limited": "上传过于频繁，请稍后再试",
    "test-env": "测试环境不支持上传，请使用正式环境",
    timeout: "请求超时，请稍后重试",
    network: "网络异常，请检查网络后重试",
    "not-found": "接口未找到",
};

const SectionHeader = (props: { title: string; extra?: string }) => (
    <div class="bmc-section-head">
        <span>{props.title}</span>
        <Show when={props.extra}>
            <span>{props.extra}</span>
        </Show>
    </div>
);

const EmptyHint = (props: { text: string }) => (
    <div class="bmc-empty">{props.text}</div>
);

/** 片段列表行（查看页只读；设置页可选中） */
const SegmentRow = (props: {
    segment: SkipSegment;
    selected?: boolean;
    /** 设置页的紧凑徽标：下一P / 跳过 */
    compact?: boolean;
    onClick?: () => void;
}) => {
    const endText = () =>
        props.segment.kind === "next" &&
        props.segment.end <= props.segment.start
            ? "结尾"
            : formatSeconds(props.segment.end);

    return (
        <div
            class="bmc-seg"
            classList={{ "is-selected": Boolean(props.selected) }}
            onClick={props.onClick}
        >
            <Show
                when={props.segment.source !== "api"}
                fallback={<span class="bmc-badge is-api">BiliSB</span>}
            >
                <span
                    class={
                        props.segment.kind === "next"
                            ? "bmc-badge is-next"
                            : "bmc-badge is-skip"
                    }
                >
                    {props.compact
                        ? props.segment.kind === "next"
                            ? "下一P"
                            : "跳过"
                        : props.segment.kind === "next"
                          ? "手动·下一P"
                          : "手动·跳过"}
                </span>
            </Show>

            <Show when={props.segment.source === "api"}>
                <span
                    class="bmc-kind"
                    title={
                        props.segment.kind === "next"
                            ? "下一 P 片段"
                            : "跳过片段"
                    }
                >
                    {props.segment.kind === "next" ? "🔚" : "⏭"}
                </span>
            </Show>

            <span class="bmc-time">
                {formatSeconds(props.segment.start)} → {endText()}
            </span>
        </div>
    );
};

/**
 * 播放页浮动窗口：查看 / 设置两页。
 * 行为与原先的命令式实现保持一致，样式仍使用手写 CSS。
 */
export function JumpPanel(props: JumpPanelProps) {
    ensurePanelStyles();

    let panelEl: HTMLDivElement | undefined;
    let headEl: HTMLDivElement | undefined;

    const [left, setLeft] = createSignal(16);
    const [top, setTop] = createSignal(16);

    const [activeTab, setActiveTab] = createSignal<JumpPanelTab>(panelTab());
    const [selectedId, setSelectedId] = createSignal<string | null>(null);
    const [editingStart, setEditingStart] = createSignal(false);
    const [editingEnd, setEditingEnd] = createSignal(false);
    const [editId, setEditId] = createSignal<string | null>(null);
    const [editKind, setEditKind] = createSignal<SegmentKind>("skip");
    const [editStartText, setEditStartText] = createSignal(
        formatSeconds(props.getCurrentTime()),
    );
    const [editEndText, setEditEndText] = createSignal(
        formatSeconds(
            Math.min(
                props.getCurrentTime() + 20,
                props.getDuration() || props.getCurrentTime() + 20,
            ),
        ),
    );

    const [userID, setUserID] = createSignal("");
    const [statusKind, setStatusKind] = createSignal<
        "info" | "success" | "error"
    >("info");
    const [statusText, setStatusText] = createSignal("");
    const [submitting, setSubmitting] = createSignal(false);
    const [apiSegments, setApiSegments] = createSignal<SkipSegment[]>([]);
    const [apiLoaded, setApiLoaded] = createSignal(false);
    const [refreshing, setRefreshing] = createSignal(false);

    let statusTimer: ReturnType<typeof setTimeout> | undefined;

    const showStatus = (text: string, kind: "info" | "success" | "error") => {
        setStatusKind(kind);
        setStatusText(text);

        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(
            () => {
                setStatusText("");
                statusTimer = undefined;
            },
            kind === "error" ? 5000 : 3000,
        );
    };

    onCleanup(() => {
        if (statusTimer) clearTimeout(statusTimer);
    });

    const statusColor = () =>
        statusKind() === "error"
            ? "#f87171"
            : statusKind() === "success"
              ? "#4ade80"
              : "rgba(255,255,255,.55)";

    const videoDuration = () => {
        const value = props.getDuration();
        return Number.isFinite(value) ? value : 0;
    };

    const isEditing = () => editingStart() || editingEnd();

    const findSegment = (id: string | null) =>
        id
            ? (uiState.config.segments.find((item) => item.id === id) ??
              apiSegments().find((item) => item.id === id) ??
              null)
            : null;

    /** 编辑框里的结束位置：next 且 end<=start 时用视频结尾 */
    const endTextFor = (segment: SkipSegment): string => {
        const end =
            segment.kind === "next" && segment.end <= segment.start
                ? videoDuration() || segment.start + 60
                : segment.end;
        return formatSeconds(end);
    };

    /**
     * 打开「设置」页时确定一个当前目标：
     * 1. 正在编辑 → 保留草稿
     * 2. 已有选中 → 保留
     * 3. 当前进度落在某个片段里 → 选中它
     * 4. 否则选第一个片段
     * 5. 一个片段都没有 → 直接进入新建草稿（起始 = 当前进度）
     */
    const prepareSubmitTab = () => {
        if (isEditing()) return;

        const selected = findSegment(selectedId());
        const now = props.getCurrentTime();

        const containing = uiState.config.segments.find(
            (segment) => now >= segment.start && now < segment.end,
        );

        const target =
            selected ?? containing ?? uiState.config.segments[0];

        if (!target) {
            setSelectedId(null);
            setEditId(null);
            setEditKind("skip");
            setEditingStart(true);
            setEditingEnd(true);
            setEditStartText(formatSeconds(now));

            const end =
                videoDuration() > 0
                    ? Math.min(now + 20, videoDuration())
                    : now + 20;
            setEditEndText(formatSeconds(Math.max(now + 1, end)));
            return;
        }

        setSelectedId(target.id);
        setEditId(target.id);
        setEditKind(target.kind);
        setEditStartText(formatSeconds(target.start));
        setEditEndText(endTextFor(target));
        setEditingStart(false);
        setEditingEnd(false);
    };

    const startNewSegment = () => {
        setSelectedId(null);
        setEditId(null);
        setEditKind("skip");
        setEditingStart(true);
        setEditingEnd(true);

        const start = props.getCurrentTime();
        setEditStartText(formatSeconds(start));

        const end =
            videoDuration() > 0
                ? Math.min(start + 20, videoDuration())
                : start + 20;
        setEditEndText(formatSeconds(Math.max(start + 1, end)));
    };

    const buildEditSegment = (): SkipSegment | null => {
        const start = parseTimeText(editStartText());
        let end = parseTimeText(editEndText());

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            showStatus("时间格式应为 时:分:秒", "error");
            return null;
        }

        if (start < 0) {
            showStatus("起始位置不能为负数", "error");
            return null;
        }

        // 结束不晚于开始时，默认取「开始 + 20 秒」
        if (end <= start) {
            end = start + 20;
            const duration = videoDuration();
            if (duration > 0 && end > duration) end = duration;

            if (end - start < MIN_SEGMENT_SECONDS) {
                showStatus("结束位置必须晚于起始位置", "error");
                return null;
            }

            setEditEndText(formatSeconds(end));
        }

        return {
            id: editId() ?? crypto.randomUUID(),
            start,
            end,
            kind: editKind(),
            source: "manual",
        };
    };

    const saveBoundary = async (which: "start" | "end") => {
        const segment = buildEditSegment();
        if (!segment) return;

        await props.onSaveSegment(segment);
        setSelectedId(segment.id);
        setEditId(segment.id);
        setEditStartText(formatSeconds(segment.start));
        setEditEndText(formatSeconds(segment.end));

        if (which === "start") {
            setEditingStart(false);
        } else {
            setEditingEnd(false);
        }

        showStatus(which === "start" ? "已保存开头" : "已保存结尾", "success");
    };

    const selectSegment = (segment: SkipSegment) => {
        setSelectedId(segment.id);
        setEditingStart(false);
        setEditingEnd(false);
        setEditId(segment.id);
        setEditKind(segment.kind);
        setEditStartText(formatSeconds(segment.start));
        setEditEndText(endTextFor(segment));
    };

    const onKindChange = (value: SegmentKind) => {
        setEditKind(value);

        const selected = findSegment(selectedId());
        const isDraft = editId() === null;

        // 未在编辑，或正在编辑一个新的草稿：切换类型时自动填入起止
        if (!isEditing() || isDraft) {
            setEditingStart(true);
            setEditingEnd(true);

            if (selected && !isEditing()) {
                setEditStartText(formatSeconds(selected.start));
                setEditEndText(endTextFor(selected));
            } else {
                const start = props.getCurrentTime();
                setEditStartText(formatSeconds(start));

                const duration = videoDuration();
                const end =
                    value === "next" && duration > 0
                        ? duration
                        : Math.min(
                              start + 20,
                              duration > 0 ? duration : start + 20,
                          );

                setEditEndText(formatSeconds(Math.max(start + 1, end)));
            }
        }
    };

    const deleteSegment = () => {
        const id = editId() ?? selectedId();
        const target = findSegment(id);

        if (target?.source === "api") {
            showStatus("云端片段不能删除", "error");
            return;
        }

        if (!id) {
            showStatus("请先选中一个片段", "error");
            return;
        }

        void props.onDeleteSegment(id).then(() => {
            setSelectedId(null);
            setEditId(null);
            setEditingStart(false);
            setEditingEnd(false);
            prepareSubmitTab();

            if (uiState.config.segments.length > 0) {
                showStatus("已删除片段", "success");
            } else {
                closePanelState();
            }
        });
    };

    const preview = () => {
        const segment = isEditing()
            ? buildEditSegment()
            : findSegment(selectedId());
        if (!segment) {
            showStatus("请先选中或新建片段", "error");
            return;
        }

        props.onPreview(segment);
        closePanelState();
    };

    const seekToStart = () => {
        const start = isEditing()
            ? parseTimeText(editStartText())
            : (findSegment(selectedId())?.start ?? Number.NaN);

        if (!Number.isFinite(start)) {
            showStatus("请先设置起始位置", "error");
            return;
        }

        props.onSeek(start);
    };

    const seekToEnd = () => {
        const segment = isEditing() ? null : findSegment(selectedId());
        const end = isEditing()
            ? parseTimeText(editEndText())
            : segment
              ? effectiveEnd(segment, videoDuration())
              : Number.NaN;

        if (!Number.isFinite(end)) {
            showStatus("请先设置结束位置", "error");
            return;
        }

        props.onSeek(end);
    };

    /** 提交成功后，把服务端返回的片段并入云端列表（带 BiliSB 标识） */
    const mergeCreatedSegments = (created: unknown) => {
        if (!Array.isArray(created)) return;

        const additions: SkipSegment[] = [];

        for (const raw of created) {
            if (!raw || typeof raw !== "object") continue;

            const record = raw as Record<string, unknown>;
            const bounds = Array.isArray(record.segment) ? record.segment : [];
            const start = Number(bounds[0]);
            const end = Number(bounds[1]);

            if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

            additions.push({
                id: String(record.UUID ?? `${start}-${end}`),
                start,
                end,
                kind: record.category === "outro" ? "next" : "skip",
                source: "api",
            });
        }

        if (additions.length === 0) return;

        setApiSegments((prev) => [
            ...prev.filter(
                (item) => !additions.some((added) => added.id === item.id),
            ),
            ...additions,
        ]);
    };

    const loadApiSegments = async (force = false): Promise<void> => {
        if (!uiState.config.useCloudSegments) {
            setApiLoaded(false);
            setApiSegments([]);
            return;
        }

        try {
            const list = (await props.onRefreshCloud?.(force)) ?? [];
            setApiSegments(
                [...list].sort((a, b) => {
                    if (a.kind !== b.kind) return a.kind === "next" ? 1 : -1;
                    return a.start - b.start;
                }),
            );
            setApiLoaded(true);
        } catch {
            // 失败时保持 apiLoaded = false，下次切回「查看」会重试
        }
    };

    const refreshCloud = async () => {
        if (refreshing()) return;

        setRefreshing(true);
        try {
            await loadApiSegments(true);
        } finally {
            setRefreshing(false);
        }
    };

    const handleSubmit = async () => {
        if (submitting()) return;

        if (userID().length < MIN_USER_ID_LENGTH) {
            showStatus(
                `私人 ID 至少需要 ${MIN_USER_ID_LENGTH} 个字符`,
                "error",
            );
            return;
        }

        const durationNow = videoDuration();
        if (durationNow <= 0) {
            showStatus("视频时长未就绪，请等视频加载后再试", "error");
            return;
        }

        const bvid = getBvidFromUrl(location.href);
        if (!bvid) {
            showStatus("未识别到当前视频的 BV 号", "error");
            return;
        }

        const segments = buildSubmitSegments(uiState.config, durationNow);
        if (segments.length === 0) {
            showStatus("当前没有可上传的片段", "error");
            return;
        }

        setSubmitting(true);
        showStatus("正在上传…", "info");

        try {
            await browser.storage.local.set({
                [USER_ID_STORAGE_KEY]: userID(),
            });

            const result = await props.onSubmit({
                bvid,
                videoDuration: durationNow,
                userID: userID(),
                segments,
            });

            if (result.ok) {
                showStatus(
                    `上传成功，共 ${segments.length} 段，等待审核`,
                    "success",
                );
                mergeCreatedSegments(result.created);
                props.onUploaded?.(result.created);
                void loadApiSegments(true);
            } else {
                const reason = result.reason ?? "";
                const base =
                    REASON_TEXT[reason] ?? `上传失败（${reason || "未知错误"}）`;
                showStatus(
                    result.message ? `${base}：${result.message}` : base,
                    "error",
                );
            }
        } catch {
            showStatus("上传失败：网络异常，请稍后重试", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // ---- 拖拽：按住标题栏移动，限制在 playerWrap 内 ----
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const clampPosition = (leftValue: number, topValue: number): [number, number] => {
        const host = props.container;
        const maxLeft = Math.max(
            0,
            host.clientWidth - (panelEl?.offsetWidth ?? 0),
        );
        const maxTop = Math.max(
            0,
            host.clientHeight - (panelEl?.offsetHeight ?? 0),
        );
        return [
            Math.min(Math.max(0, leftValue), maxLeft),
            Math.min(Math.max(0, topValue), maxTop),
        ];
    };

    const onHeadPointerDown = (event: PointerEvent) => {
        if ((event.target as HTMLElement | null)?.closest("button")) return;

        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = left();
        startTop = top();

        headEl?.setPointerCapture(event.pointerId);
        event.preventDefault();
    };

    const onHeadPointerMove = (event: PointerEvent) => {
        if (!dragging) return;

        const [nextLeft, nextTop] = clampPosition(
            startLeft + event.clientX - startX,
            startTop + event.clientY - startY,
        );
        setLeft(nextLeft);
        setTop(nextTop);
    };

    const endDrag = (event: PointerEvent) => {
        if (!dragging) return;
        dragging = false;

        if (headEl?.hasPointerCapture(event.pointerId)) {
            headEl.releasePointerCapture(event.pointerId);
        }
    };

    const switchTab = (tab: JumpPanelTab) => {
        setActiveTab(tab);

        if (tab === "submit") prepareSubmitTab();
        if (
            tab === "view" &&
            uiState.config.useCloudSegments &&
            !apiLoaded()
        ) {
            void loadApiSegments();
        }
    };

    // 外部（content / popup）请求打开窗口时，切到对应页并夹紧位置
    createEffect(
        on([panelOpen, panelTab], ([open, tab]) => {
            if (!open) return;

            setActiveTab(tab);
            if (tab === "submit") prepareSubmitTab();
            if (
                tab === "view" &&
                uiState.config.useCloudSegments &&
                !apiLoaded()
            ) {
                void loadApiSegments();
            }

            requestAnimationFrame(() => {
                const [nextLeft, nextTop] = clampPosition(left(), top());
                setLeft(nextLeft);
                setTop(nextTop);
            });
        }),
    );

    // 关闭云端片段时清空列表
    createEffect(() => {
        if (!uiState.config.useCloudSegments) {
            setApiSegments([]);
            setApiLoaded(false);
        }
    });

    // ---- 私人 ID：首次使用时自动生成并持久化 ----
    onMount(() => {
        void (async () => {
            const stored = await browser.storage.local.get({
                [USER_ID_STORAGE_KEY]: "",
            });
            const existing = String(stored[USER_ID_STORAGE_KEY] ?? "").trim();

            if (existing.length > 0) {
                setUserID(existing);
                return;
            }

            const next = generateUserID();
            setUserID(next);
            await browser.storage.local.set({
                [USER_ID_STORAGE_KEY]: next,
            });
        })();
    });

    return (
        <div
            ref={panelEl}
            class="bmc-panel"
            hidden={!panelOpen()}
            style={{ left: `${left()}px`, top: `${top()}px` }}
        >
            <div
                ref={headEl}
                class="bmc-panel-head"
                onPointerDown={onHeadPointerDown}
                onPointerMove={onHeadPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <button
                    type="button"
                    class="bmc-tab"
                    classList={{ "is-active": activeTab() === "view" }}
                    onClick={() => switchTab("view")}
                >
                    查看
                </button>
                <button
                    type="button"
                    class="bmc-tab"
                    classList={{ "is-active": activeTab() === "submit" }}
                    onClick={() => switchTab("submit")}
                >
                    设置
                </button>
                <button
                    type="button"
                    class="bmc-close"
                    title="关闭"
                    onClick={() => closePanelState()}
                >
                    ×
                </button>
            </div>

            <div class="bmc-body">
                <Show
                    when={activeTab() === "view"}
                    fallback={
                        <>
                            {/* 设置页 */}
                            <div class="bmc-section-head">
                                <span>编辑片段</span>
                                <button
                                    type="button"
                                    class="bmc-help"
                                    title="查看设置说明"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void browser.runtime.sendMessage({
                                            type: "OPEN_HELP_PAGE",
                                        });
                                    }}
                                >
                                    ?
                                </button>
                                <span
                                    class="bmc-status"
                                    style={{ color: statusColor() }}
                                    title={statusText()}
                                >
                                    {statusText()}
                                </span>
                                <span>
                                    已保存 {uiState.config.segments.length} 个
                                </span>
                            </div>

                            <div class="bmc-actions">
                                <button
                                    type="button"
                                    class={
                                        editingStart()
                                            ? "bmc-action is-primary"
                                            : "bmc-action"
                                    }
                                    onClick={() => {
                                        if (editingStart()) {
                                            void saveBoundary("start");
                                        } else {
                                            setEditingStart(true);
                                        }
                                    }}
                                >
                                    开头：{editingStart() ? "保存" : "编辑"}
                                </button>
                                <button
                                    type="button"
                                    class={
                                        editingEnd()
                                            ? "bmc-action is-primary"
                                            : "bmc-action"
                                    }
                                    onClick={() => {
                                        if (editingEnd()) {
                                            void saveBoundary("end");
                                        } else {
                                            setEditingEnd(true);
                                        }
                                    }}
                                >
                                    结尾：{editingEnd() ? "保存" : "编辑"}
                                </button>
                            </div>

                            <div class="bmc-editor">
                                <input
                                    type="text"
                                    value={editStartText()}
                                    placeholder="00:00:00"
                                    disabled={!editingStart()}
                                    onInput={(event) =>
                                        setEditStartText(event.currentTarget.value)
                                    }
                                />
                                <select
                                    value={editKind()}
                                    onChange={(event) =>
                                        onKindChange(
                                            event.currentTarget.value === "next"
                                                ? "next"
                                                : "skip",
                                        )
                                    }
                                >
                                    <option value="skip">
                                        {KIND_LABELS.skip}
                                    </option>
                                    <option value="next">
                                        {KIND_LABELS.next}
                                    </option>
                                </select>
                                <input
                                    type="text"
                                    value={editEndText()}
                                    placeholder="00:00:00"
                                    disabled={!editingEnd()}
                                    onInput={(event) =>
                                        setEditEndText(event.currentTarget.value)
                                    }
                                />
                            </div>

                            <div class="bmc-actions">
                                <button
                                    type="button"
                                    class="bmc-action"
                                    onClick={deleteSegment}
                                >
                                    删除
                                </button>
                                <button
                                    type="button"
                                    class="bmc-action"
                                    onClick={preview}
                                >
                                    预览
                                </button>
                                <button
                                    type="button"
                                    class="bmc-action"
                                    onClick={seekToStart}
                                >
                                    定位开头
                                </button>
                                <button
                                    type="button"
                                    class="bmc-action"
                                    onClick={seekToEnd}
                                >
                                    定位结尾
                                </button>
                            </div>

                            <Show
                                when={uiState.config.segments.length > 0}
                                fallback={<EmptyHint text="暂无片段" />}
                            >
                                <For each={uiState.config.segments}>
                                    {(segment) => (
                                        <SegmentRow
                                            segment={segment}
                                            compact
                                            selected={segment.id === selectedId()}
                                            onClick={() =>
                                                selectSegment(segment)
                                            }
                                        />
                                    )}
                                </For>
                            </Show>

                            <div
                                class="bmc-seg bmc-seg-new"
                                onClick={startNewSegment}
                            >
                                ＋ 新建片段（当前进度）
                            </div>

                            <Show when={uiState.config.useCloudSegments}>
                                <SectionHeader title="私人 ID" />

                                <input
                                    class="bmc-input"
                                    type="password"
                                    autocomplete="off"
                                    spellcheck={false}
                                    placeholder={`至少 ${MIN_USER_ID_LENGTH} 个字符`}
                                    value={userID()}
                                    onInput={(event) =>
                                        setUserID(
                                            event.currentTarget.value.trim(),
                                        )
                                    }
                                />

                                <div class="bmc-hint">
                                    首次使用会自动生成并保存在本地；也可以替换成你已有的私人
                                    ID。此ID仅用于标识上传者，服务端不会收集其他信息。
                                </div>

                                <button
                                    type="button"
                                    class="bmc-submit"
                                    disabled={submitting()}
                                    onClick={() => void handleSubmit()}
                                >
                                    {submitting()
                                        ? "上传中…"
                                        : "上传到 bsbsb.top"}
                                </button>
                            </Show>
                        </>
                    }
                >
                    {/* 查看页 */}
                    <SectionHeader
                        title="手动片段"
                        extra={`${uiState.config.segments.length} 个`}
                    />
                    <Show
                        when={uiState.config.segments.length > 0}
                        fallback={<EmptyHint text="暂无手动片段，去「设置」里新建" />}
                    >
                        <For each={uiState.config.segments}>
                            {(segment) => <SegmentRow segment={segment} />}
                        </For>
                    </Show>

                    <Show
                        when={uiState.config.useCloudSegments}
                        fallback={
                            <>
                                <SectionHeader title="云端片段" extra="已关闭" />
                                <EmptyHint text="云端片段已关闭，可在设置页开启" />
                            </>
                        }
                    >
                        <SectionHeader
                            title="云端片段"
                            extra={`${apiSegments().length} 个`}
                        />
                        <Show
                            when={apiSegments().length > 0}
                            fallback={<EmptyHint text="暂无云端片段" />}
                        >
                            <For each={apiSegments()}>
                                {(segment) => <SegmentRow segment={segment} />}
                            </For>
                        </Show>

                        <button
                            type="button"
                            class="bmc-refresh"
                            disabled={refreshing()}
                            onClick={() => void refreshCloud()}
                        >
                            {refreshing() ? "刷新中…" : "刷新云端片段"}
                        </button>

                        <div class="bmc-hint">
                            服务器可能有延迟，建议等待 1–2 分钟后再刷新。
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
}
