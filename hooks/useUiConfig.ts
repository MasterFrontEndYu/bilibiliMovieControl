import { createStore } from "solid-js/store";
import { browser } from "wxt/browser";
import type { UiVisibility } from "@/types/types";
import { DEFAULT_UI, normalizeUi, UI_STORAGE_KEY } from "@/utils/uiVisibility";

// ---- 模块级全局 store（选项页每个上下文各有一份） ----
const [uiStore, setUiStore] = createStore<UiVisibility>({ ...DEFAULT_UI });

let initPromise: Promise<void> | null = null;

export const initUiConfig = () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const stored = await browser.storage.local.get({
            [UI_STORAGE_KEY]: DEFAULT_UI,
        });
        const next = normalizeUi(stored[UI_STORAGE_KEY]);
        setUiStore(() => next);
    })();
    return initPromise;
};

// 其他上下文（content / popup）写入时保持同步
browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[UI_STORAGE_KEY]) return;
    const next = normalizeUi(changes[UI_STORAGE_KEY].newValue);
    setUiStore(() => next);
});

export function useUiConfig() {
    void initUiConfig();

    const update = async (patch: Partial<UiVisibility>) => {
        // 等初始值读完再写，避免初始化结果覆盖用户刚做的修改
        await initUiConfig().catch(() => undefined);

        setUiStore((prev) => ({ ...prev, ...patch }));
        await browser.storage.local.set({
            [UI_STORAGE_KEY]: { ...uiStore },
        });
    };

    return { ui: uiStore, update };
}
