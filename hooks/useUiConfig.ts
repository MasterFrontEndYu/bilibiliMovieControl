import { browser } from "wxt/browser";
import type { UiVisibility } from "@/types/types";
import {
    DEFAULT_UI,
    normalizeUi,
    UI_STORAGE_KEY,
} from "@/utils/uiVisibility";
import { createStorageStore } from "@/hooks/createStorageStore";

/** Options 页的显示开关 store（每个上下文各有一份） */
const uiStore = createStorageStore<UiVisibility>({
    initial: { ...DEFAULT_UI },
    read: async () => {
        const stored = await browser.storage.local.get({
            [UI_STORAGE_KEY]: DEFAULT_UI,
        });
        return normalizeUi(stored[UI_STORAGE_KEY]);
    },
    mapChange: (key, value) =>
        key === UI_STORAGE_KEY ? normalizeUi(value) : null,
    write: async (next) => {
        await browser.storage.local.set({ [UI_STORAGE_KEY]: next });
    },
});

export const initUiConfig = uiStore.init;

export function useUiConfig() {
    void initUiConfig().catch(() => undefined);

    return { ui: uiStore.store, update: uiStore.update };
}
