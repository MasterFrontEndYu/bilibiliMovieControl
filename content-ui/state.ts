import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type {
    Config,
    JumpPanelTab,
    SkipSegment,
    UiVisibility,
} from "@/types/types";
import { DEFAULT_UI } from "@/utils/uiVisibility";

/** content 脚本与 Solid UI 之间共享的状态 */
export interface ContentUiState {
    config: Config;
    ui: UiVisibility;
    cloudSegments: SkipSegment[];
    duration: number;
}

const INITIAL_STATE: ContentUiState = {
    config: { segments: [], useCloudSegments: true },
    ui: { ...DEFAULT_UI },
    cloudSegments: [],
    duration: 0,
};

const [uiState, setUiState] = createStore<ContentUiState>(INITIAL_STATE);

/** content 每次配置 / 云端片段变化时把最新数据推进来 */
export const updateUiData = (patch: Partial<ContentUiState>) => {
    setUiState(patch);
};

export { uiState };

// ---- 浮动窗口的显示状态（content 的 openPanel / popup 消息共用） ----
const [panelOpen, setPanelOpen] = createSignal(false);
const [panelTab, setPanelTab] = createSignal<JumpPanelTab>("view");

export { panelOpen, panelTab };

export const openPanelState = (tab: JumpPanelTab) => {
    setPanelTab(tab);
    setPanelOpen(true);
};

export const closePanelState = () => {
    setPanelOpen(false);
};
