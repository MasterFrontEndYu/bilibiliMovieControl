import { browser } from "wxt/browser";
import { MIN_SEGMENT_SECONDS } from "@/utils/segments";
import type {
    JumpPanelConfig,
    JumpPanelHandle,
    JumpPanelHandlers,
    JumpPanelTab,
    SegmentKind,
    SkipSegment,
    SubmitSegmentInput,
} from "@/types/types";

const STYLE_ID = "bmc-jump-panel-style";

const USER_ID_STORAGE_KEY = "sbUserID";
const MIN_USER_ID_LENGTH = 30;

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

const STYLE_TEXT = `
.bmc-panel{position:absolute;z-index:10000;width:320px;max-height:78%;display:flex;flex-direction:column;
background:rgba(28,28,32,.96);color:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);
font:12px/1.6 -apple-system,"Microsoft YaHei",sans-serif;overflow:hidden;}
.bmc-panel[hidden]{display:none;}
.bmc-panel-head{display:flex;align-items:center;gap:4px;padding:8px;background:rgba(255,255,255,.06);
cursor:move;user-select:none;touch-action:none;}
.bmc-tab{border:0;background:transparent;color:rgba(255,255,255,.6);padding:2px 10px;border-radius:6px;
cursor:pointer;font-size:12px;}
.bmc-tab.is-active{background:rgba(251,114,153,.2);color:#fb7299;}
.bmc-close{margin-left:auto;border:0;background:transparent;color:rgba(255,255,255,.55);
font-size:16px;line-height:1;cursor:pointer;padding:0 4px;}
.bmc-close:hover{color:#fff;}
.bmc-body{padding:10px;overflow-y:auto;}
.bmc-section-head{display:flex;justify-content:space-between;color:rgba(255,255,255,.5);
font-size:11px;margin:10px 0 4px;}
.bmc-section-head:first-child{margin-top:0;}
.bmc-help{box-sizing:border-box;width:14px;height:14px;padding:0;border-radius:50%;
border:1px solid rgba(255,255,255,.4);background:transparent;color:rgba(255,255,255,.8);
font-size:10px;line-height:12px;text-align:center;cursor:pointer;font-family:inherit;
flex:0 0 auto;margin-left:10px;}
.bmc-help:hover{background:rgba(255,255,255,.14);color:#fff;}
.bmc-seg{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;
background:rgba(255,255,255,.05);cursor:pointer;margin-top:4px;}
.bmc-seg.is-selected{outline:1px solid #fb7299;background:rgba(251,114,153,.12);}
.bmc-seg-new{justify-content:center;color:#fb7299;}
.bmc-badge{flex:0 0 auto;font-size:10px;line-height:16px;padding:0 5px;border-radius:4px;
background:rgba(255,255,255,.12);color:rgba(255,255,255,.75);}
.bmc-badge.is-skip{background:rgba(251,114,153,.18);color:#fb7299;}
.bmc-badge.is-next{background:rgba(124,58,237,.25);color:#c4b5fd;}
.bmc-badge.is-api{background:rgba(88,166,255,.2);color:#7cc4ff;}
.bmc-kind{flex:0 0 auto;font-size:11px;color:#7cc4ff;font-weight:600;}
.bmc-time{font-variant-numeric:tabular-nums;color:rgba(255,255,255,.75);font-size:11px;}
.bmc-empty{color:rgba(255,255,255,.35);padding:8px;text-align:center;}
.bmc-hint{color:rgba(255,255,255,.45);font-size:11px;line-height:1.5;margin-top:6px;}
.bmc-editor{display:flex;align-items:center;gap:4px;margin-top:6px;}
.bmc-editor input{flex:1;min-width:0;box-sizing:border-box;height:26px;padding:0 6px;
border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);
color:#fff;font-size:11px;outline:none;text-align:center;font-variant-numeric:tabular-nums;}
.bmc-editor input:focus{border-color:#fb7299;}
.bmc-editor input:disabled,.bmc-editor select:disabled{opacity:.55;cursor:default;}
.bmc-editor select{flex:0 0 72px;box-sizing:border-box;height:26px;border-radius:6px;
border:1px solid rgba(255,255,255,.15);background:#3a3a40;color:#fff;font-size:11px;outline:none;}
.bmc-import{box-sizing:border-box;width:100%;height:26px;border-radius:6px;
border:1px solid rgba(255,255,255,.15);background:#3a3a40;color:#fff;font-size:11px;outline:none;}
.bmc-actions{display:flex;gap:4px;margin-top:6px;}
.bmc-refresh{box-sizing:border-box;width:100%;height:26px;margin-top:8px;border-radius:6px;
border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;
font-size:11px;cursor:pointer;font-family:inherit;}
.bmc-refresh:hover{background:rgba(255,255,255,.16);}
.bmc-refresh:disabled{opacity:.55;cursor:default;}
.bmc-action{flex:1;box-sizing:border-box;height:24px;border:0;border-radius:6px;
background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);font-size:11px;cursor:pointer;
font-family:inherit;transition:background .15s;}
.bmc-action:hover{background:rgba(255,255,255,.18);}
.bmc-action.is-primary{background:#fb7299;color:#fff;}
.bmc-action.is-primary:hover{background:#f25d8b;}
.bmc-input{box-sizing:border-box;width:100%;height:26px;padding:0 8px;border-radius:6px;
border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;
font-size:12px;outline:none;}
.bmc-input:focus{border-color:#fb7299;}
.bmc-submit{box-sizing:border-box;width:100%;height:30px;margin-top:10px;border:0;border-radius:6px;
background:#fb7299;color:#fff;font-size:12px;cursor:pointer;font-family:inherit;
transition:background .15s;}
.bmc-submit:hover{background:#f25d8b;}
.bmc-submit:disabled{opacity:.55;cursor:default;}
.bmc-status{margin-top:8px;font-size:11px;line-height:1.5;min-height:16px;}
.bmc-section-head .bmc-status{margin:0;flex:1;min-height:0;text-align:center;
font-size:10px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bmc-footer{margin:0;padding:6px 10px;min-height:0;border-top:1px solid rgba(255,255,255,.08);}
`;

function ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.append(style);
}

function sectionHeader(title: string, extra?: string): HTMLElement {
    const head = document.createElement("div");
    head.className = "bmc-section-head";

    const name = document.createElement("span");
    name.textContent = title;
    head.append(name);

    if (extra) {
        const value = document.createElement("span");
        value.textContent = extra;
        head.append(value);
    }

    return head;
}

function emptyHint(text: string): HTMLElement {
    const hint = document.createElement("div");
    hint.className = "bmc-empty";
    hint.textContent = text;
    return hint;
}

function formatSeconds(total: number): string {
    const safe = Math.max(0, Math.floor(total));
    return `${Math.floor(safe / 3600)}:${String(
        Math.floor((safe % 3600) / 60),
    ).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** 支持 "90" / "01:30" / "00:01:30" */
function parseTimeText(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return Number.NaN;

    const parts = trimmed.split(":").map((part) => Number(part.trim()));
    if (parts.some((part) => !Number.isFinite(part))) return Number.NaN;

    if (parts.length === 3) {
        const [h = 0, m = 0, s = 0] = parts;
        return h * 3600 + m * 60 + s;
    }
    if (parts.length === 2) {
        const [m = 0, s = 0] = parts;
        return m * 60 + s;
    }
    if (parts.length === 1) return parts[0] ?? Number.NaN;

    return Number.NaN;
}

/** next 片段 end <= start 时视为"到视频结尾" */
function effectiveEnd(segment: SkipSegment, videoDuration: number): number {
    if (segment.kind === "next" && segment.end <= segment.start) {
        return videoDuration > 0 ? videoDuration : segment.start;
    }
    return videoDuration > 0
        ? Math.min(segment.end, videoDuration)
        : segment.end;
}

/** 20 字节随机数 → 40 位十六进制字符串，满足服务端 ≥30 位的要求 */
function generateUserID(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

/**
 * 把手动片段转换成待提交的片段：
 * - skip → intro（从 0 秒开始）或 sponsor
 * - next → outro（到结束位置或视频结尾）
 * 云端来源（source=api）不重复提交。
 */
export function buildSubmitSegments(
    config: JumpPanelConfig,
    videoDuration: number,
): SubmitSegmentInput[] {
    const segments: SubmitSegmentInput[] = [];

    for (const segment of config.segments) {
        if (segment.source === "api") continue;

        if (segment.kind === "skip") {
            const end =
                videoDuration > 0
                    ? Math.min(segment.end, videoDuration)
                    : segment.end;
            if (end - segment.start < MIN_SEGMENT_SECONDS) continue;

            segments.push({
                start: segment.start,
                end,
                category: segment.start <= 1 ? "intro" : "sponsor",
                actionType: "skip",
            });
            continue;
        }

        const end = effectiveEnd(segment, videoDuration);
        if (end - segment.start < MIN_SEGMENT_SECONDS) continue;

        segments.push({
            start: segment.start,
            end,
            category: "outro",
            actionType: "skip",
        });
    }

    return segments;
}

/**
 * 可拖拽的浮动窗口，挂载在 #playerWrap 内（该容器为 position: relative）。
 * 「查看」页管理手动片段（可导入、编辑、删除、预览、定位）并展示云端片段；
 * 「设置」页把手动片段上传到 bsbsb.top。
 */
export function createJumpPanel(
    host: HTMLElement,
    initial: JumpPanelConfig,
    handlers: JumpPanelHandlers,
): JumpPanelHandle {
    ensureStyles();

    let currentConfig = initial;
    let activeTab: JumpPanelTab = "view";

    let apiSegments: SkipSegment[] = [];
    let apiLoaded = false;

    let selectedId: string | null = null;
    let editingStart = false;
    let editingEnd = false;
    let editId: string | null = null;
    let editKind: SegmentKind = "skip";
    let editStartText = formatSeconds(handlers.getCurrentTime());
    let editEndText = formatSeconds(
        Math.min(
            handlers.getCurrentTime() + 20,
            handlers.getDuration() || handlers.getCurrentTime() + 20,
        ),
    );

    const isEditing = () => editingStart || editingEnd;

    let userID = "";
    let statusKind: "info" | "success" | "error" = "info";
    let submitting = false;

    const panel = document.createElement("div");
    panel.className = "bmc-panel";
    panel.hidden = true;
    panel.style.left = "16px";
    panel.style.top = "16px";

    const head = document.createElement("div");
    head.className = "bmc-panel-head";

    const viewTab = document.createElement("button");
    viewTab.type = "button";
    viewTab.className = "bmc-tab";
    viewTab.textContent = "查看";

    const submitTab = document.createElement("button");
    submitTab.type = "button";
    submitTab.className = "bmc-tab";
    submitTab.textContent = "设置";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "bmc-close";
    closeButton.title = "关闭";
    closeButton.textContent = "×";

    head.append(viewTab, submitTab, closeButton);

    const body = document.createElement("div");
    body.className = "bmc-body";

    const statusBar = document.createElement("div");
    statusBar.className = "bmc-status";

    panel.append(head, body);
    host.append(panel);

    const statusColor = () =>
        statusKind === "error"
            ? "#f87171"
            : statusKind === "success"
              ? "#4ade80"
              : "rgba(255,255,255,.55)";

    let statusTimer: ReturnType<typeof setTimeout> | null = null;

    const setStatus = (text: string, kind: "info" | "success" | "error") => {
        statusKind = kind;
        statusBar.textContent = text;
        statusBar.title = text;
        statusBar.style.color = statusColor();

        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(
            () => {
                statusBar.textContent = "";
                statusBar.title = "";
                statusTimer = null;
            },
            kind === "error" ? 5000 : 3000,
        );
    };

    const videoDuration = () => {
        const value = handlers.getDuration();
        return Number.isFinite(value) ? value : 0;
    };

    const findSegment = (id: string | null) =>
        id
            ? (currentConfig.segments.find((item) => item.id === id) ??
              apiSegments.find((item) => item.id === id) ??
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

        const selected = findSegment(selectedId);
        const now = handlers.getCurrentTime();

        const containing = currentConfig.segments.find(
            (segment) => now >= segment.start && now < segment.end,
        );

        const target = selected ?? containing ?? currentConfig.segments[0];

        if (!target) {
            selectedId = null;
            editId = null;
            editKind = "skip";
            editingStart = true;
            editingEnd = true;
            editStartText = formatSeconds(now);

            const end =
                videoDuration() > 0
                    ? Math.min(now + 20, videoDuration())
                    : now + 20;
            editEndText = formatSeconds(Math.max(now + 1, end));
            return;
        }

        selectedId = target.id;
        editId = target.id;
        editKind = target.kind;
        editStartText = formatSeconds(target.start);
        editEndText = endTextFor(target);
        editingStart = false;
        editingEnd = false;
    };

    // ---------- 查看页（只读） ----------
    const renderSegmentRow = (segment: SkipSegment): HTMLElement => {
        const row = document.createElement("div");
        row.className = "bmc-seg";

        const badge = document.createElement("span");
        if (segment.source === "api") {
            badge.className = "bmc-badge is-api";
            badge.textContent = "BiliSB";
        } else if (segment.kind === "next") {
            badge.className = "bmc-badge is-next";
            badge.textContent = "手动·下一P";
        } else {
            badge.className = "bmc-badge is-skip";
            badge.textContent = "手动·跳过";
        }

        const time = document.createElement("span");
        time.className = "bmc-time";
        const end =
            segment.kind === "next" && segment.end <= segment.start
                ? "结尾"
                : formatSeconds(segment.end);
        time.textContent = `${formatSeconds(segment.start)} → ${end}`;

        row.append(badge);

        if (segment.source === "api") {
            const kindMark = document.createElement("span");
            kindMark.className = "bmc-kind";
            kindMark.textContent = segment.kind === "next" ? "🔚" : "⏭";
            kindMark.title =
                segment.kind === "next" ? "下一 P 片段" : "跳过片段";
            row.append(kindMark);
        }

        row.append(time);
        return row;
    };

    const startNewSegment = () => {
        selectedId = null;
        editId = null;
        editKind = "skip";
        editingStart = true;
        editingEnd = true;

        const start = handlers.getCurrentTime();
        editStartText = formatSeconds(start);

        const end =
            videoDuration() > 0
                ? Math.min(start + 20, videoDuration())
                : start + 20;
        editEndText = formatSeconds(Math.max(start + 1, end));

        render();
    };

    const buildEditSegment = (): SkipSegment | null => {
        const start = parseTimeText(editStartText);
        let end = parseTimeText(editEndText);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            setStatus("时间格式应为 时:分:秒", "error");
            return null;
        }

        if (start < 0) {
            setStatus("起始位置不能为负数", "error");
            return null;
        }

        // 结束不晚于开始时，默认取「开始 + 20 秒」
        if (end <= start) {
            end = start + 20;
            const duration = videoDuration();
            if (duration > 0 && end > duration) end = duration;

            if (end - start < MIN_SEGMENT_SECONDS) {
                setStatus("结束位置必须晚于起始位置", "error");
                return null;
            }

            editEndText = formatSeconds(end);
        }

        return {
            id: editId ?? crypto.randomUUID(),
            start,
            end,
            kind: editKind,
            source: "manual",
        };
    };

    const saveBoundary = async (which: "start" | "end") => {
        const segment = buildEditSegment();
        if (!segment) {
            render();
            return;
        }

        await handlers.onSaveSegment(segment);
        selectedId = segment.id;
        editId = segment.id;
        editStartText = formatSeconds(segment.start);
        editEndText = formatSeconds(segment.end);

        if (which === "start") {
            editingStart = false;
        } else {
            editingEnd = false;
        }

        setStatus(
            which === "start" ? "已保存开头" : "已保存结尾",
            "success",
        );
        render();
    };

    const renderEditor = (): HTMLElement => {
        const wrapper = document.createElement("div");

        // 起始 / 类型 / 结束
        const editor = document.createElement("div");
        editor.className = "bmc-editor";

        const startInput = document.createElement("input");
        startInput.type = "text";
        startInput.value = editStartText;
        startInput.placeholder = "00:00:00";
        startInput.disabled = !editingStart;
        startInput.addEventListener("input", () => {
            editStartText = startInput.value;
        });

        const kindSelect = document.createElement("select");
        for (const kind of ["skip", "next"] as const) {
            const option = document.createElement("option");
            option.value = kind;
            option.textContent = KIND_LABELS[kind];
            option.selected = kind === editKind;
            kindSelect.append(option);
        }
        kindSelect.addEventListener("change", () => {
            editKind = kindSelect.value === "next" ? "next" : "skip";

            const selected = findSegment(selectedId);
            const isDraft = editId === null;

            // 未在编辑，或正在编辑一个新的草稿：切换类型时自动填入起止
            if (!isEditing() || isDraft) {
                editingStart = true;
                editingEnd = true;

                if (selected && !isEditing()) {
                    editStartText = formatSeconds(selected.start);
                    editEndText = endTextFor(selected);
                } else {
                    const start = handlers.getCurrentTime();
                    editStartText = formatSeconds(start);

                    const duration = videoDuration();
                    const end =
                        editKind === "next" && duration > 0
                            ? duration
                            : Math.min(
                                  start + 20,
                                  duration > 0 ? duration : start + 20,
                              );

                    editEndText = formatSeconds(Math.max(start + 1, end));
                }

                render();
            }
        });

        const endInput = document.createElement("input");
        endInput.type = "text";
        endInput.value = editEndText;
        endInput.placeholder = "00:00:00";
        endInput.disabled = !editingEnd;
        endInput.addEventListener("input", () => {
            editEndText = endInput.value;
        });

        // 开头 / 结尾 各自独立：编辑 / 保存
        const boundary = document.createElement("div");
        boundary.className = "bmc-actions";

        const makeBoundary = (
            label: string,
            active: boolean,
            onClick: () => void,
        ) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = active
                ? "bmc-action is-primary"
                : "bmc-action";
            button.textContent = `${label}：${active ? "保存" : "编辑"}`;
            button.addEventListener("click", onClick);
            return button;
        };

        boundary.append(
            makeBoundary("开头", editingStart, () => {
                if (editingStart) {
                    void saveBoundary("start");
                } else {
                    editingStart = true;
                    render();
                }
            }),
            makeBoundary("结尾", editingEnd, () => {
                if (editingEnd) {
                    void saveBoundary("end");
                } else {
                    editingEnd = true;
                    render();
                }
            }),
        );

        editor.append(startInput, kindSelect, endInput);
        wrapper.append(boundary);
        wrapper.append(editor);

        // 五个操作
        const actions = document.createElement("div");
        actions.className = "bmc-actions";

        const makeAction = (
            label: string,
            onClick: () => void,
            primary = false,
        ) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = primary
                ? "bmc-action is-primary"
                : "bmc-action";
            button.textContent = label;
            button.addEventListener("click", onClick);
            return button;
        };

        actions.append(
            makeAction("删除", () => {
                const id = editId ?? selectedId;
                const target = findSegment(id);

                if (target?.source === "api") {
                    setStatus("云端片段不能删除", "error");
                    render();
                    return;
                }

                if (!id) {
                    setStatus("请先选中一个片段", "error");
                    render();
                    return;
                }

                void handlers.onDeleteSegment(id).then(() => {
                    selectedId = null;
                    editId = null;
                    editingStart = false;
                    editingEnd = false;
                    prepareSubmitTab();

                    if (currentConfig.segments.length > 0) {
                        setStatus("已删除片段", "success");
                        render();
                    } else {
                        close();
                    }
                });
            }),
            makeAction("预览", () => {
                const segment = isEditing()
                    ? buildEditSegment()
                    : findSegment(selectedId);
                if (!segment) {
                    setStatus("请先选中或新建片段", "error");
                    render();
                    return;
                }

                handlers.onPreview(segment);
                close();
            }),
            makeAction("定位开头", () => {
                const start = isEditing()
                    ? parseTimeText(editStartText)
                    : (findSegment(selectedId)?.start ?? Number.NaN);

                if (!Number.isFinite(start)) {
                    setStatus("请先设置起始位置", "error");
                    render();
                    return;
                }

                handlers.onSeek(start);
            }),
            makeAction("定位结尾", () => {
                const segment = isEditing() ? null : findSegment(selectedId);
                const end = isEditing()
                    ? parseTimeText(editEndText)
                    : segment
                      ? effectiveEnd(segment, videoDuration())
                      : Number.NaN;

                if (!Number.isFinite(end)) {
                    setStatus("请先设置结束位置", "error");
                    render();
                    return;
                }

                handlers.onSeek(end);
            }),
        );

        wrapper.append(actions);

        return wrapper;
    };

    const renderView = (): DocumentFragment => {
        const fragment = document.createDocumentFragment();

        fragment.append(
            sectionHeader("手动片段", `${currentConfig.segments.length} 个`),
        );
        if (currentConfig.segments.length === 0) {
            fragment.append(emptyHint("暂无手动片段，去「设置」里新建"));
        } else {
            for (const segment of currentConfig.segments) {
                fragment.append(renderSegmentRow(segment));
            }
        }

        if (!currentConfig.useCloudSegments) {
            fragment.append(sectionHeader("云端片段", "已关闭"));
            fragment.append(emptyHint("云端片段已关闭，可在设置页开启"));
        } else {
            fragment.append(
                sectionHeader("云端片段", `${apiSegments.length} 个`),
            );
            if (apiSegments.length === 0) {
                fragment.append(emptyHint("暂无云端片段"));
            } else {
                for (const segment of apiSegments) {
                    fragment.append(renderSegmentRow(segment));
                }
            }

            const refreshButton = document.createElement("button");
            refreshButton.type = "button";
            refreshButton.className = "bmc-refresh";
            refreshButton.textContent = "刷新云端片段";
            refreshButton.addEventListener("click", () => {
                if (refreshButton.disabled) return;
                refreshButton.disabled = true;
                refreshButton.textContent = "刷新中…";
                void loadApiSegments(true);
            });
            fragment.append(refreshButton);

            const refreshHint = document.createElement("div");
            refreshHint.className = "bmc-hint";
            refreshHint.textContent =
                "服务器可能有延迟，建议等待 1–2 分钟后再刷新。";
            fragment.append(refreshHint);
        }

        return fragment;
    };

    // ---------- 提交页 ----------
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

        apiSegments = [
            ...apiSegments.filter(
                (item) => !additions.some((added) => added.id === item.id),
            ),
            ...additions,
        ];
    };

    const handleSubmit = async (button: HTMLButtonElement) => {
        const showStatus = (text: string, kind: "info" | "success" | "error") => {
            setStatus(text, kind);
        };

        if (submitting) return;

        if (userID.length < MIN_USER_ID_LENGTH) {
            showStatus(`私人 ID 至少需要 ${MIN_USER_ID_LENGTH} 个字符`, "error");
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

        const segments = buildSubmitSegments(currentConfig, durationNow);
        if (segments.length === 0) {
            showStatus("当前没有可上传的片段", "error");
            return;
        }

        submitting = true;
        button.disabled = true;
        button.textContent = "上传中…";
        showStatus("正在上传…", "info");

        try {
            await browser.storage.local.set({ [USER_ID_STORAGE_KEY]: userID });

            const result = await handlers.onSubmit({
                bvid,
                videoDuration: durationNow,
                userID,
                segments,
            });

            if (result.ok) {
                showStatus(
                    `上传成功，共 ${segments.length} 段，等待审核`,
                    "success",
                );
                mergeCreatedSegments(result.created);
                handlers.onUploaded?.(result.created);
                void loadApiSegments(true);
            } else {
                const reason = result.reason ?? "";
                const base =
                    REASON_TEXT[reason] ??
                    `上传失败（${reason || "未知错误"}）`;
                const message = result.message
                    ? `${base}：${result.message}`
                    : base;

                console.warn("[BMC] 上传失败", result);
                showStatus(message, "error");
            }
        } catch {
            showStatus("上传失败：网络异常，请稍后重试", "error");
        } finally {
            submitting = false;
            button.disabled = false;
            button.textContent = "上传到 bsbsb.top";
        }
    };

    /** 设置页的片段行：点击载入编辑器 */
    const renderUploadRow = (segment: SkipSegment): HTMLElement => {
        const row = document.createElement("div");
        row.className = "bmc-seg";
        if (segment.id === selectedId) row.classList.add("is-selected");

        const badge = document.createElement("span");
        badge.className =
            segment.kind === "next" ? "bmc-badge is-next" : "bmc-badge is-skip";
        badge.textContent = segment.kind === "next" ? "下一P" : "跳过";

        const time = document.createElement("span");
        time.className = "bmc-time";
        const end =
            segment.kind === "next" && segment.end <= segment.start
                ? "结尾"
                : formatSeconds(segment.end);
        time.textContent = `${formatSeconds(segment.start)} → ${end}`;

        row.append(badge, time);
        row.addEventListener("click", () => {
            selectedId = segment.id;
            editingStart = false;
            editingEnd = false;
            editId = segment.id;
            editKind = segment.kind;
            editStartText = formatSeconds(segment.start);
            editEndText = endTextFor(segment);
            render();
        });

        return row;
    };

    const renderSubmit = (): HTMLElement => {
        const wrapper = document.createElement("div");

        // 标题行：编辑片段 | 状态提示 | 已保存 N 个
        const header = document.createElement("div");
        header.className = "bmc-section-head";

        const title = document.createElement("span");
        title.textContent = "编辑片段";

        const help = document.createElement("button");
        help.type = "button";
        help.className = "bmc-help";
        help.textContent = "?";
        help.title = "查看设置说明";
        help.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            void browser.runtime.sendMessage({ type: "OPEN_HELP_PAGE" });
        });

        const count = document.createElement("span");
        count.textContent = `已保存 ${currentConfig.segments.length} 个`;

        header.append(title, help, statusBar, count);
        wrapper.append(header);

        wrapper.append(renderEditor());

        if (currentConfig.segments.length === 0) {
            wrapper.append(emptyHint("暂无片段"));
        } else {
            for (const segment of currentConfig.segments) {
                wrapper.append(renderUploadRow(segment));
            }
        }

        const newRow = document.createElement("div");
        newRow.className = "bmc-seg bmc-seg-new";
        newRow.textContent = "＋ 新建片段（当前进度）";
        newRow.addEventListener("click", () => {
            selectedId = null;
            startNewSegment();
        });
        wrapper.append(newRow);

        if (currentConfig.useCloudSegments) {
            wrapper.append(sectionHeader("私人 ID"));

            const input = document.createElement("input");
            input.className = "bmc-input";
            input.type = "password";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.placeholder = `至少 ${MIN_USER_ID_LENGTH} 个字符`;
            input.value = userID;
            input.addEventListener("input", () => {
                userID = input.value.trim();
            });
            wrapper.append(input);

            const idHint = document.createElement("div");
            idHint.className = "bmc-hint";
            idHint.textContent =
                "首次使用会自动生成并保存在本地；也可以替换成你已有的私人 ID。此ID仅用于标识上传者，服务端不会收集其他信息。";
            wrapper.append(idHint);

            const submitButton = document.createElement("button");
            submitButton.type = "button";
            submitButton.className = "bmc-submit";
            submitButton.textContent = submitting
                ? "上传中…"
                : "上传到 bsbsb.top";
            submitButton.disabled = submitting;

            submitButton.addEventListener("click", () => {
                void handleSubmit(submitButton);
            });

            wrapper.append(submitButton);
        }

        return wrapper;
    };

    // ---------- 通用 ----------
    const clampPosition = (left: number, top: number): [number, number] => {
        const maxLeft = Math.max(0, host.clientWidth - panel.offsetWidth);
        const maxTop = Math.max(0, host.clientHeight - panel.offsetHeight);
        return [
            Math.min(Math.max(0, left), maxLeft),
            Math.min(Math.max(0, top), maxTop),
        ];
    };

    const render = () => {
        body.replaceChildren();
        body.append(activeTab === "view" ? renderView() : renderSubmit());
    };

    const setTab = (tab: JumpPanelTab) => {
        activeTab = tab;
        viewTab.classList.toggle("is-active", tab === "view");
        submitTab.classList.toggle("is-active", tab === "submit");

        if (tab === "submit") prepareSubmitTab();
        if (tab === "view" && currentConfig.useCloudSegments && !apiLoaded) {
            void loadApiSegments();
        }
        render();
    };

    const open = (tab?: JumpPanelTab) => {
        if (tab) {
            setTab(tab);
        } else {
            render();
        }
        panel.hidden = false;

        const [left, top] = clampPosition(panel.offsetLeft, panel.offsetTop);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    };

    const close = () => {
        panel.hidden = true;
    };

    viewTab.addEventListener("click", () => setTab("view"));
    submitTab.addEventListener("click", () => setTab("submit"));
    closeButton.addEventListener("click", close);

    // ---- 私人 ID：首次使用时自动生成并持久化 ----
    void (async () => {
        const stored = await browser.storage.local.get({
            [USER_ID_STORAGE_KEY]: "",
        });
        const existing = String(stored[USER_ID_STORAGE_KEY] ?? "").trim();

        if (existing.length > 0) {
            userID = existing;

            // 首次直接点「设置」时，输入框已经渲染为空，补上已保存的 ID
            if (!panel.hidden) {
                const input =
                    panel.querySelector<HTMLInputElement>(".bmc-input");
                if (input && !input.value) input.value = userID;
            }
            return;
        }

        userID = generateUserID();
        await browser.storage.local.set({ [USER_ID_STORAGE_KEY]: userID });

        if (!panel.hidden) render();
    })();

    // ---- 云端片段：打开查看页时拉一次，也可手动强制刷新 ----
    async function loadApiSegments(force = false): Promise<void> {
        if (!currentConfig.useCloudSegments) {
            apiLoaded = false;
            apiSegments = [];
            return;
        }

        try {
            const list = (await handlers.onRefreshCloud?.(force)) ?? [];
            apiSegments = [...list].sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === "next" ? 1 : -1;
                return a.start - b.start;
            });
            apiLoaded = true;
        } catch {
            // 失败时保持 apiLoaded = false，下次切回「查看」会重试
        }

        if (!panel.hidden && activeTab === "view") render();
    }

    // ---- 拖拽：按住标题栏移动，限制在 playerWrap 内 ----
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    head.addEventListener("pointerdown", (event) => {
        if ((event.target as HTMLElement | null)?.closest("button")) return;

        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;

        head.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    head.addEventListener("pointermove", (event) => {
        if (!dragging) return;

        const [left, top] = clampPosition(
            startLeft + event.clientX - startX,
            startTop + event.clientY - startY,
        );
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    });

    const endDrag = (event: PointerEvent) => {
        if (!dragging) return;
        dragging = false;

        if (head.hasPointerCapture(event.pointerId)) {
            head.releasePointerCapture(event.pointerId);
        }
    };

    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);

    setTab("view");

    return {
        open,
        close,
        update: (config) => {
            const wasEnabled = currentConfig.useCloudSegments;
            currentConfig = config;

            if (!config.useCloudSegments) {
                apiSegments = [];
                apiLoaded = false;
            } else if (!wasEnabled && !panel.hidden && activeTab === "view") {
                void loadApiSegments();
            }

            if (!panel.hidden) render();
        },
        destroy: () => {
            if (statusTimer) clearTimeout(statusTimer);
            panel.remove();
        },
    };
}
