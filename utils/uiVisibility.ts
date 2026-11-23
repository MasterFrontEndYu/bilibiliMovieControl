import type { UiVisibility } from "@/types/types";

/**
 * 播放页「状态那一行」的显示开关。
 * 放在独立的 storage key 下，不并进 Config：
 * 历史快照（HistoryConfig）和面板配置（JumpPanelConfig）都不需要它。
 */
export const UI_STORAGE_KEY = "uiVisibility";

/** 默认全部显示：老用户升级后行为不变 */
export const DEFAULT_UI: UiVisibility = {
    actionView: true,
    actionSubmit: true,
    cloudLink: true,
    statusSkip: true,
    statusNext: true,
    statusCloud: true,
};

/**
 * 把 storage 里读到的值补成完整开关表。
 * 缺失 / 类型不对 / 以后新增字段时都回落到默认值。
 */
export const normalizeUi = (raw: unknown): UiVisibility => {
    const source =
        raw && typeof raw === "object"
            ? (raw as Record<string, unknown>)
            : ({} as Record<string, unknown>);

    const next = { ...DEFAULT_UI };
    for (const key of Object.keys(DEFAULT_UI) as (keyof UiVisibility)[]) {
        const value = source[key];
        if (typeof value === "boolean") next[key] = value;
    }
    return next;
};

/** 这一行是否已经完全不可见（用于决定要不要挂载整行） */
export const isUiEmpty = (ui: UiVisibility): boolean =>
    !Object.values(ui).some(Boolean);
