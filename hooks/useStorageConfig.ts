import { browser } from "wxt/browser";
import type { Config } from "@/types/types";
import { loadSegments, normalizeSegments } from "@/utils/segments";
import {
    createDefaultConfig,
    DEFAULT_USE_CLOUD_SEGMENTS,
} from "@/utils/configDefaults";
import { createStorageStore } from "@/hooks/createStorageStore";

/** 跨上下文共享的配置 store（每个上下文各有一份） */
const configStore = createStorageStore<Config>({
    initial: createDefaultConfig(),
    read: async () => {
        const [segments, stored] = await Promise.all([
            loadSegments(),
            browser.storage.local.get({
                useCloudSegments: DEFAULT_USE_CLOUD_SEGMENTS,
            }),
        ]);

        return {
            segments,
            useCloudSegments: stored.useCloudSegments !== false,
        };
    },
    mapChange: (key, value) => {
        if (key === "segments") {
            return {
                segments: Array.isArray(value)
                    ? normalizeSegments(value)
                    : [],
            };
        }

        if (key === "useCloudSegments") {
            return { useCloudSegments: value !== false };
        }

        return null;
    },
    write: async (_next, patch) => {
        const data: Record<string, unknown> = {};

        if (patch.segments !== undefined) {
            data.segments = normalizeSegments(patch.segments);
        }
        if (patch.useCloudSegments !== undefined) {
            data.useCloudSegments = patch.useCloudSegments;
        }

        if (Object.keys(data).length > 0) {
            await browser.storage.local.set(data);
        }
    },
});

/** 初始化只跑一次（幂等） */
export const initGlobalConfig = configStore.init;

// ---- 按 keys 返回的 hook ----
export function useConfig<K extends keyof Config>(keys: K[]) {
    void initGlobalConfig().catch(() => undefined);

    const keySet = new Set<K>(keys);

    const config = new Proxy({} as Pick<Config, K>, {
        get(_, prop: string | symbol) {
            if (typeof prop !== "string" || !keySet.has(prop as K))
                return undefined;
            return (configStore.store as any)[prop];
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
        const patch: Partial<Config> = {};

        for (const key of keys) {
            if (key in data) patch[key] = data[key];
        }

        if (Object.keys(patch).length === 0) return;
        await configStore.update(patch);
    };

    return { config, update };
}
