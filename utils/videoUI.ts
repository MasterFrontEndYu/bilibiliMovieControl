import { formatTime, toSeconds } from "@/utils/bilibili";
import type { VideoUIConfig, VideoUIHandle } from "@/types/types";

const BADGE_STYLE =
    "display:inline-flex;align-items:center;gap:8px;padding:0 12px;color:#fff;" +
    "border-radius:8px;font-size:12px;font-family:sans-serif;" +
    "transition:background .2s,box-shadow .2s;";

/**
 * 页面内悬浮状态条（原生 DOM 实现，不依赖任何 UI 框架）。
 * 挂载到 WXT 注入的容器里，由调用方在配置变化时调用 update()。
 */
export function createVideoUI(container: HTMLElement): VideoUIHandle {
    const root = document.createElement("div");
    root.style.cssText = "display:inline-flex;align-items:center;gap:12px;";

    const badge = document.createElement("div");
    badge.style.cssText = BADGE_STYLE;

    const count = document.createElement("span");
    count.title = "跳过段数";

    const divider = document.createElement("span");
    divider.style.cssText =
        "display:inline-block;width:2px;height:16px;background:rgba(255,255,255,.5);";

    const jump = document.createElement("span");

    badge.append(count, divider, jump);

    const warn = document.createElement("span");
    warn.textContent = "⚠ OP区间超过切集点，会导致一直跳转。";
    warn.style.cssText =
        "display:none;margin-left:8px;font-size:12px;color:#b45309;";

    root.append(badge, warn);
    container.append(root);

    const update = (cfg: VideoUIConfig) => {
        const ranges = cfg.opRanges ?? [];
        const jumpSec = toSeconds(cfg.jumpConfig);
        const conflict =
            jumpSec > 0 && ranges.some((r) => toSeconds(r.end) >= jumpSec);

        count.textContent = `⏭ ${ranges.length} 段`;
        jump.textContent = `🏁 切集点: ${
            jumpSec > 0 ? formatTime(cfg.jumpConfig) : "未设置"
        }`;

        badge.style.background = conflict ? "#f59e0b" : "#fb7299";
        badge.style.boxShadow = conflict
            ? "0 2px 6px rgba(245,158,11,.4)"
            : "0 2px 6px rgba(251,114,153,.3)";
        warn.style.display = conflict ? "inline" : "none";
    };

    return {
        update,
        destroy: () => root.remove(),
    };
}
