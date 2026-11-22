import { browser } from "wxt/browser";
import { getBvidFromUrl } from "@/utils/bilibili";
import { MIN_SEGMENT_SECONDS } from "@/utils/segments";
import type {
    ApiSegment,
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
    skip: "OP跳过",
    next: "下一P",
};

const REASON_TEXT: Record<string, string> = {
    "bad-bvid": "视频 BV 号无效",
    "bad-request": "上传参数不完整",
    "bad-json": "接口返回数据异常",
    rejected: "上传被服务端拒绝（403）",
    duplicate: "这段内容已经上传过（409）",
    "rate-limited": "上传过于频繁，请稍后再试",
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
.bmc-seg{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;
background:rgba(255,255,255,.05);cursor:pointer;margin-top:4px;}
.bmc-seg.is-selected{outline:1px solid #fb7299;background:rgba(251,114,153,.12);}
.bmc-seg-new{justify-content:center;color:#fb7299;}
.bmc-badge{flex:0 0 auto;font-size:10px;line-height:16px;padding:0 5px;border-radius:4px;
background:rgba(255,255,255,.12);color:rgba(255,255,255,.75);}
.bmc-badge.is-skip{background:rgba(251,114,153,.18);color:#fb7299;}
.bmc-badge.is-next{background:rgba(124,58,237,.25);color:#c4b5fd;}
.bmc-badge.is-api{background:rgba(88,166,255,.2);color:#7cc4ff;}
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
function buildSubmitSegments(
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
 * 「提交」页把手动片段上传到 bsbsb.top。
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
    let editing = false;
    let editId: string | null = null;
    let editKind: SegmentKind = "skip";
    let editStartText = formatSeconds(handlers.getCurrentTime());
    let editEndText = formatSeconds(
        Math.min(
            handlers.getCurrentTime() + 30,
            handlers.getDuration() || handlers.getCurrentTime() + 30,
        ),
    );

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
    submitTab.textContent = "上传";

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
        statusBar.style.color = statusColor();

        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(
            () => {
                statusBar.textContent = "";
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
            badge.textContent = "手动·OP";
        }

        const time = document.createElement("span");
        time.className = "bmc-time";
        const end =
            segment.kind === "next" && segment.end <= segment.start
                ? "结尾"
                : formatSeconds(segment.end);
        time.textContent = `${formatSeconds(segment.start)} → ${end}`;

        row.append(badge, time);
        return row;
    };

    const beginEditing = (segment: SkipSegment | null) => {
        editing = true;
        editKind = segment?.kind ?? "skip";
        editId = segment && segment.source === "manual" ? segment.id : null;

        const start = segment ? segment.start : handlers.getCurrentTime();
        editStartText = formatSeconds(start);

        if (segment) {
            editEndText = endTextFor(segment);
        } else {
            const end =
                videoDuration() > 0
                    ? Math.min(start + 30, videoDuration())
                    : start + 30;
            editEndText = formatSeconds(Math.max(start + 1, end));
        }

        render();
    };

    const buildEditSegment = (): SkipSegment | null => {
        const start = parseTimeText(editStartText);
        const end = parseTimeText(editEndText);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            setStatus("时间格式应为 时:分:秒", "error");
            return null;
        }

        if (start < 0 || end <= start) {
            setStatus("结束位置必须晚于起始位置", "error");
            return null;
        }

        if (end - start < MIN_SEGMENT_SECONDS) {
            setStatus(`片段长度至少 ${MIN_SEGMENT_SECONDS} 秒`, "error");
            return null;
        }

        return {
            id: editId ?? crypto.randomUUID(),
            start,
            end,
            kind: editKind,
            source: "manual",
        };
    };

    const saveEditing = async () => {
        const segment = buildEditSegment();
        if (!segment) {
            render();
            return;
        }

        await handlers.onSaveSegment(segment);
        selectedId = segment.id;
        editId = segment.id;
        editing = false;
        setStatus("已保存片段", "success");
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
        startInput.disabled = !editing;
        startInput.addEventListener("input", () => {
            editStartText = startInput.value;
        });

        const kindSelect = document.createElement("select");
        kindSelect.disabled = !editing;
        for (const kind of ["skip", "next"] as const) {
            const option = document.createElement("option");
            option.value = kind;
            option.textContent = KIND_LABELS[kind];
            option.selected = kind === editKind;
            kindSelect.append(option);
        }
        kindSelect.addEventListener("change", () => {
            editKind = kindSelect.value === "next" ? "next" : "skip";
        });

        const endInput = document.createElement("input");
        endInput.type = "text";
        endInput.value = editEndText;
        endInput.placeholder = "00:00:00";
        endInput.disabled = !editing;
        endInput.addEventListener("input", () => {
            editEndText = endInput.value;
        });

        editor.append(startInput, kindSelect, endInput);
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
                    editing = false;

                    const start = handlers.getCurrentTime();
                    editStartText = formatSeconds(start);
                    const end =
                        videoDuration() > 0
                            ? Math.min(start + 30, videoDuration())
                            : start + 30;
                    editEndText = formatSeconds(Math.max(start + 1, end));

                    if (currentConfig.segments.length > 0) {
                        setStatus("已删除片段", "success");
                        render();
                    } else {
                        close();
                    }
                });
            }),
            makeAction("预览", () => {
                const segment = editing
                    ? buildEditSegment()
                    : findSegment(selectedId);
                if (!segment) {
                    render();
                    return;
                }

                handlers.onPreview(segment);
                close();
            }),
            makeAction("开头", () => {
                const start = editing
                    ? parseTimeText(editStartText)
                    : (findSegment(selectedId)?.start ?? Number.NaN);

                if (!Number.isFinite(start)) {
                    setStatus("请先设置起始位置", "error");
                    render();
                    return;
                }

                handlers.onSeek(start);
            }),
            makeAction("结尾", () => {
                const segment = editing ? null : findSegment(selectedId);
                const end = editing
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
            makeAction(
                editing ? "保存" : "编辑",
                () => {
                    if (editing) {
                        void saveEditing();
                    } else {
                        beginEditing(findSegment(selectedId));
                    }
                },
                true,
            ),
        );

        wrapper.append(actions);

        const hint = document.createElement("div");
        hint.className = "bmc-hint";
        hint.textContent = "提示：可用 ← / → 微调时间。";
        wrapper.append(hint);

        return wrapper;
    };

    const renderView = (): DocumentFragment => {
        const fragment = document.createDocumentFragment();

        fragment.append(
            sectionHeader("手动片段", `${currentConfig.segments.length} 个`),
        );
        if (currentConfig.segments.length === 0) {
            fragment.append(emptyHint("暂无手动片段，去「上传」里新建"));
        } else {
            for (const segment of currentConfig.segments) {
                fragment.append(renderSegmentRow(segment));
            }
        }

        fragment.append(sectionHeader("云端片段", `${apiSegments.length} 个`));
        if (apiSegments.length === 0) {
            fragment.append(emptyHint("暂无云端片段"));
        } else {
            for (const segment of apiSegments) {
                fragment.append(renderSegmentRow(segment));
            }
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
            } else {
                const reason = result.reason ?? "";
                showStatus(
                    REASON_TEXT[reason] ?? `上传失败（${reason || "未知错误"}）`,
                    "error",
                );
            }
        } catch {
            showStatus("上传失败：网络异常，请稍后重试", "error");
        } finally {
            submitting = false;
            button.disabled = false;
            button.textContent = "上传到 bsbsb.top";
        }
    };

    /** 上传页的片段行：点击载入编辑器 */
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
            editing = false;
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

        wrapper.append(sectionHeader("编辑片段"));
        wrapper.append(renderEditor());

        wrapper.append(
            sectionHeader("已保存片段", `${currentConfig.segments.length} 个`),
        );

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
            beginEditing(null);
        });
        wrapper.append(newRow);

        wrapper.append(statusBar);

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
            "首次使用会自动生成并保存在本地；也可以替换成你已有的私人 ID。";
        wrapper.append(idHint);

        const submitButton = document.createElement("button");
        submitButton.type = "button";
        submitButton.className = "bmc-submit";
        submitButton.textContent = submitting ? "上传中…" : "上传到 bsbsb.top";
        submitButton.disabled = submitting;

        submitButton.addEventListener("click", () => {
            void handleSubmit(submitButton);
        });

        wrapper.append(submitButton);
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

        if (tab === "view" && !apiLoaded) void loadApiSegments();
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
            return;
        }

        userID = generateUserID();
        await browser.storage.local.set({ [USER_ID_STORAGE_KEY]: userID });

        if (!panel.hidden) render();
    })();

    // ---- 云端片段：打开查看页时拉一次 ----
    async function loadApiSegments(): Promise<void> {
        apiLoaded = true;

        const bvid = getBvidFromUrl(location.href);
        if (!bvid) return;

        try {
            const result = (await browser.runtime.sendMessage({
                type: "SB_LOOKUP",
                data: { bvid },
            })) as { ok?: boolean; segments?: ApiSegment[] } | undefined;

            if (!result?.ok || !Array.isArray(result.segments)) return;

            apiSegments = result.segments
                .filter(
                    (segment) =>
                        segment.actionType === "skip" ||
                        segment.actionType === "poi",
                )
                .slice(0, 30)
                .map((segment) => ({
                    id: segment.id,
                    start: segment.start,
                    end: segment.end,
                    kind:
                        segment.category === "outro"
                            ? ("next" as const)
                            : ("skip" as const),
                    source: "api" as const,
                }));

            if (!panel.hidden && activeTab === "view") render();
        } catch {
            // 云端片段只是展示，失败静默忽略
        }
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
            currentConfig = config;
            if (!panel.hidden) render();
        },
        destroy: () => {
            if (statusTimer) clearTimeout(statusTimer);
            panel.remove();
        },
    };
}
