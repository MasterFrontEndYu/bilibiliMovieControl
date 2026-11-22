import { createStore } from "solid-js";
import { browser } from "wxt/browser";
import type { Config } from "@/types/types";
import { loadSegments } from "@/utils/segments";

const INITIAL_CONFIG: Config = {
    segments: [],
};

export const STORAGE_KEYS = Object.keys(INITIAL_CONFIG) as (keyof Config)[];

// ---- 模块级全局 store（每个上下文各有一份） ----
const [globalConfig, setGlobalConfig] = createStore<Config>(INITIAL_CONFIG);

// 初始化只跑一次（幂等）
let initPromise: Promise<void> | null = null;

export const initGlobalConfig = () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const segments = await loadSegments();
        setGlobalConfig((prev) => ({ ...prev, segments }));
    })();
    return initPromise;
};

// ⭐ 关键：跨上下文同步
// popup / options 任意一处写 storage，
// 其他上下文的 storage.onChanged 都会触发，把新值写回各自的 globalConfig
browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const patch: Partial<Config> = {};
    for (const k of STORAGE_KEYS) {
        if (changes[k]) (patch as any)[k] = changes[k].newValue;
    }
    if (Object.keys(patch).length === 0) return;
    setGlobalConfig((prev) => ({ ...prev, ...patch }));
});

// ---- 按 keys 返回的 hook ----
export function useConfig<K extends keyof Config>(keys: K[]) {
    void initGlobalConfig();

    const keySet = new Set<K>(keys);

    const config = new Proxy({} as Pick<Config, K>, {
        get(_, prop: string | symbol) {
            if (typeof prop !== "string" || !keySet.has(prop as K))
                return undefined;
            return (globalConfig as any)[prop];
        },
        has(_, prop: string | symbol) {
            return typeof prop === "string" && keySet.has(prop as K);
        },
        ownKeys() {
            return keys.map(String);
        },
        getOwnPropertyDescriptor(_, prop: string | symbol) {
            if (typeof prop !== "string" || !keySet.has(prop as K))
                return undefined;
            return { enumerable: true, configurable: true };
        },
    });

    const update = async (data: Partial<Pick<Config, K>>) => {
        const sanitized: Partial<Config> = {};
        for (const k of keys) {
            if (k in data) (sanitized as any)[k] = (data as any)[k];
        }
        if (Object.keys(sanitized).length === 0) return;

        setGlobalConfig((prev: Config) => ({ ...prev, ...sanitized }));
        await browser.storage.local.set(sanitized as Record<string, unknown>);
    };

    return { config, update };
}
