import { effectiveCloudSegments, effectiveEnd } from "@/utils/segments";
import { uiState } from "@/content-ui/state";
import type { SkipSegment } from "@/types/types";

/** 控制条正常显示时：插在原生进度条里的标记层 */
const LAYER_ID = "bmc-progress-markers";
/** 控制条自动隐藏后：插在底部原生细进度条里的标记层 */
const IDLE_LAYER_ID = "bmc-idle-markers";

/** 控制条里的原生进度条 */
const CONTAINER_SELECTOR = ".bpx-player-progress";
/**
 * 控制条自动隐藏后 B 站留在播放器最底部的那条细进度条。
 * 它自带轨道、缓冲条和已播放进度（子元素用 transform: scaleX 表示进度），
 * 所以色块直接画在它身上就会像控制条自己的进度条，而不是悬在半空的一条色带。
 */
const IDLE_SELECTOR =
    ".bpx-player-shadow-progress-area .bpx-player-progress-schedule";
/** 万一 schedule 节点改名了，退到整个 shadow 进度区域 */
const IDLE_FALLBACK_SELECTOR = ".bpx-player-shadow-progress-area";

/** 跳过片段：紫色；下一P：红色（都做成不透明感较强的实色，压过进度条） */
const SKIP_COLOR = "rgba(168,85,247,.95)";
const NEXT_COLOR = "rgba(239,68,68,.95)";

const BASE_LAYER_CSS =
    "position:absolute;left:0;top:0;width:100%;height:100%;" +
    "pointer-events:none;overflow:hidden;";

/** 一个标记层的位置缓存：宿主、元素、上次绘制用的签名 */
interface MarkerLayer {
    host: HTMLElement | null;
    el: HTMLElement | null;
    signature: string;
}

const createLayer = (): MarkerLayer => ({
    host: null,
    el: null,
    signature: "",
});

const controlLayer = createLayer();
const idleLayer = createLayer();

/** 参与展示的片段：手动 + 云端（与手动重叠的云端片段忽略，和播放逻辑一致） */
const collectSegments = (): SkipSegment[] => {
    const manual = uiState.config.segments ?? [];
    const cloud = uiState.config.useCloudSegments
        ? effectiveCloudSegments(manual, uiState.cloudSegments)
        : [];

    return [...cloud, ...manual];
};

const ensurePositioned = (el: HTMLElement) => {
    if (getComputedStyle(el).position === "static") {
        el.style.position = "relative";
    }
};

/** 把片段画成一排绝对定位的色块，左右按占时长算 */
const render = (
    target: HTMLElement,
    duration: number,
    segments: SkipSegment[],
) => {
    const percent = (seconds: number) =>
        Math.min(100, Math.max(0, (seconds / duration) * 100));

    target.replaceChildren();

    for (const segment of segments) {
        const start = Math.max(0, segment.start);
        const end = Math.min(duration, effectiveEnd(segment, duration));
        if (!(end > start)) continue;

        const bar = document.createElement("div");
        bar.style.cssText =
            "position:absolute;top:0;bottom:0;" +
            `left:${percent(start)}%;width:${percent(end) - percent(start)}%;` +
            `background:${segment.kind === "next" ? NEXT_COLOR : SKIP_COLOR};`;
        bar.title = segment.kind === "next" ? "下一P片段" : "跳过片段";
        target.append(bar);
    }
};

/** 控制条是否处于显示状态（B 站隐藏时会给控制条子树设 visibility/opacity） */
const isControlVisible = (el: HTMLElement): boolean => {
    if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
        });
    }

    const computed = getComputedStyle(el);
    return computed.visibility !== "hidden" && computed.opacity !== "0";
};

const clearLayer = (state: MarkerLayer) => {
    state.el?.remove();
    state.el = null;
    state.host = null;
    state.signature = "";
};

/** 插到拖拽手柄之前、轨道/已播放条之后：色块压在最上层，手柄和光标仍在上面 */
const insertInProgressBar = (host: HTMLElement, el: HTMLElement) => {
    const anchor =
        host.querySelector<HTMLElement>(".bpx-player-progress-thumb") ??
        host.querySelector<HTMLElement>(".bpx-player-progress-cursor");

    if (anchor) {
        host.insertBefore(el, anchor);
    } else {
        host.append(el);
    }
};

/** 追加在缓冲条 / 已播放条之后，色块压在原生进度填充上 */
const appendLayer = (host: HTMLElement, el: HTMLElement) => {
    host.append(el);
};

const mountLayer = (
    state: MarkerLayer,
    host: HTMLElement,
    id: string,
    zIndex: number,
    insert: (host: HTMLElement, el: HTMLElement) => void,
) => {
    clearLayer(state);
    ensurePositioned(host);

    const el = document.createElement("div");
    el.id = id;
    el.style.cssText = `${BASE_LAYER_CSS}z-index:${zIndex};`;
    insert(host, el);

    state.host = host;
    state.el = el;
};

/**
 * 同步一个标记层：宿主变化 / 被 B 站重渲染掉时重新挂载，
 * 可见性跟随调用方传入的开关，数据签名变化时才重绘色块。
 */
const syncLayer = (
    state: MarkerLayer,
    host: HTMLElement | null,
    visible: boolean,
    duration: number,
    segments: SkipSegment[],
    signature: string,
    id: string,
    zIndex: number,
    insert: (host: HTMLElement, el: HTMLElement) => void,
) => {
    if (!host) {
        clearLayer(state);
        return;
    }

    if (state.host !== host || !state.el || !state.el.isConnected) {
        mountLayer(state, host, id, zIndex, insert);
    }

    const el = state.el!;
    el.style.visibility = visible ? "visible" : "hidden";

    if (signature !== state.signature) {
        render(el, duration, segments);
        state.signature = signature;
    }
};

/**
 * 按当前片段数据绘制进度条标记。
 * 由 content 的主循环每 200ms 调一次：引擎只在数据或容器变化时重绘。
 *
 * 控制条显示时画在控制条自己的进度条上；控制条自动隐藏后，
 * B 站会把底部那条 shadow progress 细进度条露出来，色块就改画到它身上，
 * 因此永远不会留在原来的位置「悬空」。
 */
export function syncProgressMarkers(duration: number): void {
    const controlEl = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
    const idleEl =
        document.querySelector<HTMLElement>(IDLE_SELECTOR) ??
        document.querySelector<HTMLElement>(IDLE_FALLBACK_SELECTOR);

    if (!(duration > 0) || (!controlEl && !idleEl)) {
        removeProgressMarkers();
        return;
    }

    const segments = collectSegments();
    const signature = `${Math.round(duration * 1000)}|${segments
        .map(
            (segment) =>
                `${segment.id}:${segment.kind}:${segment.start}:${segment.end}`,
        )
        .join(",")}`;

    const controlVisible = !!controlEl && isControlVisible(controlEl);

    // 控制条隐藏时整棵子树会淡出，但有的布局只设 visibility，
    // 子元素再写 visible 会「漏」出来，所以按真实可见性兜底
    syncLayer(
        controlLayer,
        controlEl,
        controlVisible && uiState.ui.progressMarkers,
        duration,
        segments,
        signature,
        LAYER_ID,
        0,
        insertInProgressBar,
    );

    syncLayer(
        idleLayer,
        idleEl,
        !controlVisible && uiState.ui.idleMarkers,
        duration,
        segments,
        signature,
        IDLE_LAYER_ID,
        1,
        appendLayer,
    );
}

/** 离开合集页 / 脚本失效时清掉标记 */
export function removeProgressMarkers(): void {
    clearLayer(controlLayer);
    clearLayer(idleLayer);
}
