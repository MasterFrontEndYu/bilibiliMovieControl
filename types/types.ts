// 全项目共享的类型定义集中在此文件，实现文件里不再声明 type / interface。

import type { Options as SolidPluginOptions } from "@solidjs/vite-plugin";

// ============================================================
// 时间
// ============================================================

export interface TimePoint {
    h: number; // 小时
    m: number; // 分钟
    s: number; // 秒
}

export interface TimeRange {
    id: string; // 唯一标识，用于列表渲染和删除逻辑
    start: TimePoint; // 起始时间
    end: TimePoint; // 结束时间
}

// ============================================================
// 配置
// ============================================================

export interface Config {
    opRanges: TimeRange[]; // 跳过列表
    jumpConfig: TimePoint; // 切集点
}

/** 内容脚本只关心这两项配置 */
export type ContentConfig = Pick<Config, "opRanges" | "jumpConfig">;

// ============================================================
// 历史记录
// ============================================================

export interface HistoryConfig extends Config {
    id: number;
    title: string;
    url: string;
    time: number;
}

export interface HistoryListConfig {
    maxLength: number;
    isPinned: boolean;
    items: HistoryConfig[];
}

export interface HistoryCollection {
    id: string;
    title: string;
    items: HistoryConfig[];
}

/** 历史归档类型：latest = 自动存档，pinned = 手动存档 */
export type HistoryKind = "latest" | "pinned";

/** 自动存档 / 手动存档共用的快照字段 */
export interface HistorySnapshot {
    id?: number;
    title: string;
    url: string;
    opRanges: TimeRange[];
    jumpConfig: TimePoint;
}

// ============================================================
// 页面内悬浮条
// ============================================================

/** 悬浮条只关心这两项配置 */
export type VideoUIConfig = Pick<Config, "opRanges" | "jumpConfig">;

export interface VideoUIHandle {
    update: (config: VideoUIConfig) => void;
    destroy: () => void;
}

// ============================================================
// 内容脚本操作区（按钮组 + 浮动窗口）
// ============================================================

export type JumpPanelTab = "view" | "submit";

/** 浮动窗口只关心这两项配置 */
export type JumpPanelConfig = Pick<Config, "opRanges" | "jumpConfig">;

export interface JumpPanelHandle {
    open: (tab?: JumpPanelTab) => void;
    close: () => void;
    update: (config: JumpPanelConfig) => void;
    destroy: () => void;
}

export interface ActionButtonHandlers {
    onView: () => void;
    onSubmit: () => void;
}

/** 按钮配色：primary = 粉色（查看），secondary = 淡蓝（提交） */
export type ActionButtonVariant = "primary" | "secondary";

export interface ActionButtonsHandle {
    destroy: () => void;
}

// ============================================================
// 表单组件
// ============================================================

export type TimeValue = TimePoint;

export interface TimeInputProps {
    label: string;
    value: TimeValue;
    onChange: (next: TimeValue) => void;
    delay?: number;
}

/** 输入框里的原始字符串草稿（允许用户输入非法中间态） */
export interface TimeInputDraft {
    h: string;
    m: string;
    s: string;
}

export interface TimeRangeManagerProps {
    ranges: TimeRange[];
    onUpdate: (newConfig: { opRanges: TimeRange[] }) => void;
    onClose: () => void;
}

// ============================================================
// BilibiliSponsorBlock API
// ============================================================

/**
 * /api/skipSegments 返回的单个片段（已归一化）。
 * actionType 已知取值：skip / mute / full / poi / chapter，服务端可能新增。
 */
export interface ApiSegment {
    id: string; // 片段 UUID
    cid: string; // 所属分P 的 cid，未知时为空串
    start: number; // 开始时间（秒）
    end: number; // 结束时间（秒）
    category: string; // intro / outro / sponsor / ...
    actionType: string; // skip / mute / full / poi / chapter
    locked: number;
    votes: number;
    videoDuration: number; // 提交时的视频时长（秒）
}

export type ApiLookupReason =
    | "bad-bvid"
    | "bad-request"
    | "bad-json"
    | "duplicate"
    | "network"
    | "not-found"
    | "rate-limited"
    | "rejected"
    | "timeout"
    | `http-${number}`;

export interface ApiLookupResult {
    ok: boolean;
    segments: ApiSegment[];
    fromCache: boolean;
    reason?: ApiLookupReason;
}

/** 提交时单个片段（秒） */
export interface SubmitSegmentInput {
    start: number;
    end: number;
    category?: string;
    actionType?: string;
}

export interface SubmitSegmentsParams {
    bvid: string;
    cid?: string;
    videoDuration: number;
    userID: string;
    segments: SubmitSegmentInput[];
}

export interface SubmitResult {
    ok: boolean;
    reason?: ApiLookupReason;
    created?: unknown;
}

// ============================================================
// WXT 自定义模块
// ============================================================

export interface SolidModuleOptions {
    vite?: SolidPluginOptions;
}

declare module "wxt" {
    export interface InlineConfig {
        solid?: SolidModuleOptions;
    }
}
