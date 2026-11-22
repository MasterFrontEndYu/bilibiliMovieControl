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

export interface BiliVideoConfig extends Config {
    isPageReady: boolean;
}

/** 内容脚本只关心这两项配置 */
export type ContentConfig = Pick<BiliVideoConfig, "opRanges" | "jumpConfig">;

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
export type VideoUIConfig = Pick<BiliVideoConfig, "opRanges" | "jumpConfig">;

export interface VideoUIHandle {
    update: (config: VideoUIConfig) => void;
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
