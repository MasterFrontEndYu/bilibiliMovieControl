import { createMemo, Show } from "solid-js";
import { formatTime, toSeconds } from "@/utils/bilibili";
import type { BiliVideoConfig } from "@/types/types";

type VideoUIConfig = Pick<BiliVideoConfig, "opRanges" | "jumpConfig">;

interface VideoUIProps {
    config: VideoUIConfig;
}

export const VideoUI = (props: VideoUIProps) => {
    /** 切集点（秒），0 视为未设置 */
    const jumpPoint = createMemo(() => toSeconds(props.config.jumpConfig));

    /**
     * opRanges 中是否存在 end 大于等于切集点的段。
     * 切集点 <= 0 视为未启用，不提示。
     */
    const hasConflict = createMemo(() => {
        const jp = jumpPoint();
        if (jp <= 0) return false;

        const ranges = props.config.opRanges;
        if (!ranges || ranges.length === 0) return false;

        return ranges.some((r) => toSeconds(r.end) >= jp);
    });

    return (
        <div
            style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "12px",
            }}
        >
            <div
                style={{
                    display: "inline-flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "0 12px",
                    background: hasConflict() ? "#f59e0b" : "#fb7299",
                    color: "white",
                    "border-radius": "8px",
                    "font-size": "12px",
                    "box-shadow": hasConflict()
                        ? "0 2px 6px rgba(245,158,11,0.4)"
                        : "0 2px 6px rgba(251,114,153,0.3)",
                    "font-family": "sans-serif",
                    transition: "background 0.2s, box-shadow 0.2s",
                }}
            >
                <span style="display:inline-block;" title="跳过段数">
                    ⏭ {props.config.opRanges.length} 段
                </span>
                <span style="display:inline-block;width: 2px;height: 16px;background: rgba(255,255,255,0.5);"></span>
                <span style="display:inline-block;">
                    🏁 切集点:{" "}
                    {jumpPoint() > 0
                        ? formatTime(props.config.jumpConfig)
                        : "未设置"}
                </span>
            </div>
            <Show when={hasConflict()}>
                <span
                    style={{
                        "margin-left": "8px",
                        "font-size": "12px",
                        color: "#b45309",
                    }}
                >
                    ⚠ OP区间超过切集点，会导致一直跳转。
                </span>
            </Show>
        </div>
    );
};
