import { createStore } from "solid-js";
import { browser } from "wxt/browser";
import type { BiliVideoConfig } from "@/types/types";

const INITIAL_CONFIG: BiliVideoConfig = {
    opRanges: [],
    frameConfig: { h: 0, m: 0, s: 0 },
    jumpConfig: { h: 0, m: 0, s: 0 },
    mode: "manual" as const,
    isAutoHandle: true,
    isPageReady: false,
};

export const STORAGE_KEYS = Object.keys(
    INITIAL_CONFIG,
) as (keyof BiliVideoConfig)[];

// ---- 模块级全局 store（所有组件共享同一份） ----
const [globalConfig, setGlobalConfig] =
    createStore<BiliVideoConfig>(INITIAL_CONFIG);

// 初始化只跑一次（幂等）
let initPromise: Promise<void> | null = null;
export const initGlobalConfig = () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const res = await browser.storage.local.get(STORAGE_KEYS as string[]);
        setGlobalConfig((prev) => ({
            ...prev,
            ...(res as Partial<BiliVideoConfig>),
        }));
    })();
    return initPromise;
};

// ---- 按 keys 返回的 hook ----
export function useConfig<K extends keyof BiliVideoConfig>(keys: K[]) {
    void initGlobalConfig();

    const keySet = new Set<K>(keys);

    // 响应式代理视图：读 globalConfig，但类型上只暴露 keys 对应的字段
    const config = new Proxy({} as Pick<BiliVideoConfig, K>, {
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

    // 只在 keys 范围内更新，防止误改未声明的字段
    const update = async (data: Partial<Pick<BiliVideoConfig, K>>) => {
        const sanitized: Partial<BiliVideoConfig> = {};
        for (const k of keys) {
            if (k in data) (sanitized as any)[k] = (data as any)[k];
        }
        if (Object.keys(sanitized).length === 0) return;

        setGlobalConfig((prev: BiliVideoConfig) => ({ ...prev, ...sanitized }));
        await browser.storage.local.set(sanitized as Record<string, unknown>);
    };

    return { config, update };
}
