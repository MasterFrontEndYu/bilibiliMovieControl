import { createMemo, Show } from "solid-js";
import { formatTime, toSeconds } from "@/utils/bilibili";
import type { BiliVideoConfig } from "@/types/types";

type VideoUIConfig = Pick<
    BiliVideoConfig,
    "opRanges" | "jumpConfig" | "frameConfig" | "mode"
>;

interface VideoUIProps {
    config: VideoUIConfig;
    isAnalyzing: () => boolean;
}

export const VideoUI = (props: VideoUIProps) => {
    /** 当前模式的跳转点（秒） */
    const jumpPoint = createMemo(() =>
        props.config.mode === "manual"
            ? toSeconds(props.config.jumpConfig)
            : toSeconds(props.config.frameConfig),
    );

    /**
     * opRanges 中是否存在 end 严格大于当前跳转点的段。
     * 跳转点 <= 0 视为未启用，不提示。
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
                    {props.config.mode === "manual"
                        ? `🏁 切集起点: ${formatTime(props.config.jumpConfig)}`
                        : `🔍 分析起点: ${formatTime(
                              props.config.frameConfig,
                          )}`}
                </span>
                <span
                    style={{
                        display: "inline-block",
                        width: "8px",
                        "margin-left": "4px",
                        animation: "blink 1s infinite",
                        color: "#fff",
                    }}
                >
                    {props.isAnalyzing() ? "●" : ""}
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
