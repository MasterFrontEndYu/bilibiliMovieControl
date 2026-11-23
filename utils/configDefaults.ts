import type { Config } from "@/types/types";

/** 云端片段默认参与跳转（内容脚本 / Options / Popup 共用同一默认值） */
export const DEFAULT_USE_CLOUD_SEGMENTS = true;

/** 每次返回新对象，避免多个上下文共享同一个 segments 数组 */
export const createDefaultConfig = (): Config => ({
    segments: [],
    useCloudSegments: DEFAULT_USE_CLOUD_SEGMENTS,
});
