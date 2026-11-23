/**
 * 全项目共用的时间格式化。
 * 秒 → "0:00:00"（小时不补零）；非法值按 0 处理，避免出现 "NaN:NaN:NaN"。
 */
export function formatSeconds(total: number): string {
    const safe = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;

    return `${Math.floor(safe / 3600)}:${String(
        Math.floor((safe % 3600) / 60),
    ).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** 秒 → "00:00:00"（小时补零、四舍五入），用于设置页 / 详情页的表格展示 */
export function formatClockTime(total: number): string {
    const safe = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;

    return `${String(Math.floor(safe / 3600)).padStart(2, "0")}:${String(
        Math.floor((safe % 3600) / 60),
    ).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
