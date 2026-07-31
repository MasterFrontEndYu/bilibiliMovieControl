export const VideoUI = (props: any) => {
    return (
        <div
            style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "8px",
                padding: "0 12px",
                background: "#fb7299",
                color: "white",
                "border-radius": "8px",
                "font-size": "12px",
                "box-shadow": "0 2px 6px rgba(251,114,153,0.3)",
                "font-family": "sans-serif",
            }}
        >
            <span style="display:inline-block;" title="跳过段数">
                ⏭ {props.opRanges().length} 段
            </span>
            <span style="display:inline-block;width: 2px;height: 16px;background: rgba(255,255,255,0.5);"></span>
            <span style="display:inline-block;">
                {props.mode() === "manual"
                    ? `🏁 切集起点: ${props.formatTime(props.jumpConfig())}`
                    : `🔍 分析起点: ${props.formatTime(props.frameConfig())}`}
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
    );
};
