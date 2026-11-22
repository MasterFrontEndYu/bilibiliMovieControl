import { formatTime, toSeconds } from "@/utils/bilibili";
import type {
    JumpPanelConfig,
    JumpPanelHandle,
    JumpPanelTab,
} from "@/types/types";

const STYLE_ID = "bmc-jump-panel-style";

const STYLE_TEXT = `
.bmc-panel{position:absolute;z-index:10000;width:300px;max-height:70%;display:flex;flex-direction:column;
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
.bmc-row{padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.05);
font-variant-numeric:tabular-nums;}
.bmc-row + .bmc-row{margin-top:4px;}
.bmc-empty{color:rgba(255,255,255,.35);padding:8px;text-align:center;}
.bmc-hint{color:rgba(255,255,255,.45);font-size:11px;}
.bmc-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:6px;min-height:120px;color:rgba(255,255,255,.4);}
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

/** 查看页：OP 跳过区间 + 切集点 */
function renderView(config: JumpPanelConfig): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const ranges = config.opRanges ?? [];

    fragment.append(sectionHeader("OP 跳过", `${ranges.length} 段`));

    if (ranges.length === 0) {
        fragment.append(emptyHint("暂无 OP 跳过区间"));
    } else {
        for (const range of ranges) {
            const row = document.createElement("div");
            row.className = "bmc-row";
            row.textContent = `${formatTime(range.start)} → ${formatTime(range.end)}`;
            fragment.append(row);
        }
    }

    fragment.append(sectionHeader("切集点"));

    const jumpRow = document.createElement("div");
    jumpRow.className = "bmc-row";
    jumpRow.textContent =
        toSeconds(config.jumpConfig) > 0
            ? formatTime(config.jumpConfig)
            : "未设置";
    fragment.append(jumpRow);

    const hint = document.createElement("div");
    hint.className = "bmc-hint";
    hint.style.marginTop = "6px";
    hint.textContent = "0:00:00 视为未启用切集";
    fragment.append(hint);

    return fragment;
}

/** 提交页占位内容（功能后续实现） */
function renderSubmitPlaceholder(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bmc-placeholder";

    const icon = document.createElement("div");
    icon.textContent = "⬆";
    icon.style.fontSize = "22px";

    const title = document.createElement("div");
    title.textContent = "提交功能开发中";

    const hint = document.createElement("div");
    hint.className = "bmc-hint";
    hint.textContent = "后续可将 OP 区间与切集点提交到 bsbsb.top";

    wrap.append(icon, title, hint);
    return wrap;
}

/**
 * 可拖拽的浮动窗口，挂载在 #playerWrap 内（该容器为 position: relative）。
 * 目前提供「查看」页，展示当前 OP 跳过区间与切集点；「提交」页暂为占位。
 */
export function createJumpPanel(
    host: HTMLElement,
    initial: JumpPanelConfig,
): JumpPanelHandle {
    ensureStyles();

    let currentConfig = initial;
    let activeTab: JumpPanelTab = "view";

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
    submitTab.textContent = "提交";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "bmc-close";
    closeButton.title = "关闭";
    closeButton.textContent = "×";

    head.append(viewTab, submitTab, closeButton);

    const body = document.createElement("div");
    body.className = "bmc-body";

    panel.append(head, body);
    host.append(panel);

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
        body.append(
            activeTab === "view"
                ? renderView(currentConfig)
                : renderSubmitPlaceholder(),
        );
    };

    const setTab = (tab: JumpPanelTab) => {
        activeTab = tab;
        viewTab.classList.toggle("is-active", tab === "view");
        submitTab.classList.toggle("is-active", tab === "submit");
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
        destroy: () => panel.remove(),
    };
}
