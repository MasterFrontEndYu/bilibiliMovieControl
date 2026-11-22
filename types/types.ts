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

// ============================================================
// 片段（统一模型）
// ============================================================

/** skip = OP 跳过；next = 到点切换下一 P */
export type SegmentKind = "skip" | "next";

/** manual = 用户手动设置；api = 从 BilibiliSponsorBlock 查到或提交后返回的 */
export type SegmentSource = "manual" | "api";

export interface SkipSegment {
    id: string;
    start: number; // 秒
    end: number; // 秒；next 类型 end <= start 表示"到视频结尾"
    kind: SegmentKind;
    source: SegmentSource;
}

// ============================================================
// 配置
// ============================================================

export interface Config {
    segments: SkipSegment[];
    /** 是否把云端片段并入播放判断 */
    useCloudSegments: boolean;
}

export type ContentConfig = Config;

// ============================================================
// 历史记录
// ============================================================

export interface HistoryConfig extends Omit<Config, "useCloudSegments"> {
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
    segments: SkipSegment[];
}

// ============================================================
// 页面内悬浮条
// ============================================================

export type VideoUIConfig = Config;

export interface VideoUIHandle {
    update: (config: VideoUIConfig, cloudSegments?: SkipSegment[]) => void;
    destroy: () => void;
}

// ============================================================
// 内容脚本操作区（按钮组 + 浮动窗口）
// ============================================================

export type JumpPanelTab = "view" | "submit";

export type JumpPanelConfig = Config;

export interface JumpPanelHandle {
    open: (tab?: JumpPanelTab) => void;
    close: () => void;
    update: (config: JumpPanelConfig) => void;
    destroy: () => void;
}

/** 提交页交给外层（content）的数据 */
export interface JumpPanelSubmitPayload {
    bvid: string;
    videoDuration: number;
    userID: string;
    segments: SubmitSegmentInput[];
}

export interface JumpPanelHandlers {
    onSubmit: (payload: JumpPanelSubmitPayload) => Promise<SubmitResult>;
    /** 上传成功后通知外层刷新云端片段 */
    onUploaded?: () => void;
    /** 新增或更新一个手动片段（按 id upsert） */
    onSaveSegment: (segment: SkipSegment) => Promise<void>;
    onDeleteSegment: (id: string) => Promise<void>;
    onSeek: (seconds: number) => void;
    /** 临时把片段注入播放判断，预览一次 */
    onPreview: (segment: SkipSegment) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
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
    | "test-env"
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
    /** 分P 序号，缺省为 1 */
    page?: number;
    videoDuration: number;
    userID: string;
    segments: SubmitSegmentInput[];
}

/** bilibili pagelist 里的分P信息（用于补 cid / 规范时长） */
export interface BiliVideoPage {
    cid: string;
    duration: number;
}

export interface SubmitResult {
    ok: boolean;
    reason?: ApiLookupReason;
    created?: unknown;
    /** 服务端返回的错误文本（如果有） */
    message?: string;
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
