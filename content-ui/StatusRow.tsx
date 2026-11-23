import { For, Show, createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { pickNextSegment } from "@/utils/segments";
import { formatSeconds } from "@/content-ui/time";
import { uiState } from "@/content-ui/state";

export interface StatusRowProps {
    onOpenCloud: () => void;
    onView: () => void;
    onOpenSubmit: () => void;
}

type Style = JSX.CSSProperties;

const ROW_STYLE: Style = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "12px",
    width: "100%",
};

const LEFT_STYLE: Style = {
    display: "inline-flex",
    "align-items": "center",
    gap: "12px",
    "min-width": "0",
};

const RIGHT_STYLE: Style = {
    display: "inline-flex",
    "align-items": "center",
    gap: "8px",
};

const BADGE_STYLE: Style = {
    display: "inline-flex",
    "align-items": "center",
    gap: "8px",
    padding: "0 12px",
    color: "#fff",
    "border-radius": "8px",
    "font-size": "12px",
    "font-family": "sans-serif",
    transition: "background .2s,box-shadow .2s",
};

const DIVIDER_STYLE: Style = {
    display: "inline-block",
    width: "2px",
    height: "16px",
    background: "rgba(255,255,255,.5)",
};

const WARNING_STYLE: Style = {
    "margin-left": "8px",
    "font-size": "12px",
    color: "#b45309",
};

const CLOUD_LINK_STYLE: Style = {
    color: "#00a1d6",
    "font-size": "12px",
    "line-height": "1",
    "text-decoration": "none",
    border: "1px solid rgba(0,161,214,.45)",
    "border-radius": "6px",
    padding: "2px 8px",
    background: "rgba(0,161,214,.08)",
    cursor: "pointer",
    "font-family": "sans-serif",
    "margin-left": "2px",
};

const BUTTON_BASE: Style = {
    "box-sizing": "border-box",
    height: "18px",
    padding: "0 8px",
    "border-radius": "5px",
    "font-size": "11px",
    "line-height": "16px",
    cursor: "pointer",
    "font-family": "sans-serif",
    border: "1px solid transparent",
    transition: "background .15s,border-color .15s",
};

const BUTTON_THEMES = {
    primary: {
        normal: {
            background: "#fb7299",
            color: "#fff",
            "border-color": "#fb7299",
        },
        hover: { background: "#f25d8b", "border-color": "#f25d8b" },
    },
    secondary: {
        normal: {
            background: "#e6f4fe",
            color: "#2d8ccf",
            "border-color": "#bfe2f7",
        },
        hover: { background: "#d3ecfd", "border-color": "#a9d8f3" },
    },
} as const;

function ActionButton(props: {
    label: string;
    variant: keyof typeof BUTTON_THEMES;
    onClick: () => void;
}) {
    const [hover, setHover] = createSignal(false);
    const theme = () => BUTTON_THEMES[props.variant];

    return (
        <button
            type="button"
            style={{
                ...BUTTON_BASE,
                ...theme().normal,
                ...(hover() ? theme().hover : {}),
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onClick();
            }}
        >
            {props.label}
        </button>
    );
}

/**
 * 播放页顶部那一行：左侧状态条 + 右侧操作按钮。
 * 样式沿用原生命令式实现的 inline style。
 */
export function StatusRow(props: StatusRowProps) {
    const segments = () => uiState.config.segments ?? [];
    const skipSegments = () =>
        segments().filter((segment) => segment.kind === "skip");
    const nextSegments = () =>
        segments().filter((segment) => segment.kind === "next");

    const cloudSkip = () =>
        uiState.cloudSegments.filter((segment) => segment.kind === "skip")
            .length;
    const cloudNext = () =>
        uiState.cloudSegments.filter((segment) => segment.kind === "next")
            .length;

    const conflict = () =>
        nextSegments().some(
            (nextSegment) =>
                nextSegment.start > 0 &&
                skipSegments().some(
                    (skipSegment) => skipSegment.end >= nextSegment.start,
                ),
        );

    const nextSegment = () =>
        pickNextSegment(segments(), uiState.cloudSegments, uiState.duration);

    const cloudTitle = () =>
        uiState.config.useCloudSegments
            ? `云端片段：跳过 ${cloudSkip()} / 下一P ${cloudNext()}${
                  cloudNext() > 1 ? "（实际取 start 最大 1 条）" : ""
              }`
            : "云端片段已关闭，可在设置页开启";

    const statusItems = () => {
        const items: { key: string; title: string; text: string }[] = [];

        if (uiState.ui.statusSkip) {
            items.push({
                key: "skip",
                title: "片段跳过数量",
                text: `⏭ 片段跳过 ${skipSegments().length} 段`,
            });
        }

        if (uiState.ui.statusNext) {
            const next = nextSegment();
            items.push({
                key: "next",
                title: "下一 P 片段起点时间",
                text: next ? `🔚  ${formatSeconds(next.start)}` : "🔚  未设置",
            });
        }

        if (uiState.ui.statusCloud) {
            items.push({
                key: "cloud",
                title: cloudTitle(),
                text: uiState.config.useCloudSegments
                    ? `☁ 云端 ${cloudSkip() + cloudNext()} 个`
                    : "☁ 云端 关",
            });
        }

        return items;
    };

    const badgeStyle = (): Style => ({
        ...BADGE_STYLE,
        background: conflict() ? "#f59e0b" : "#fb7299",
        "box-shadow": conflict()
            ? "0 2px 6px rgba(245,158,11,.4)"
            : "0 2px 6px rgba(251,114,153,.3)",
    });

    return (
        <div style={ROW_STYLE}>
            <div style={LEFT_STYLE}>
                <Show when={statusItems().length > 0}>
                    <div style={badgeStyle()}>
                        <For each={statusItems()}>
                            {(item, index) => (
                                <>
                                    <Show when={index() > 0}>
                                        <span style={DIVIDER_STYLE}></span>
                                    </Show>
                                    <span title={item.title}>{item.text}</span>
                                </>
                            )}
                        </For>
                    </div>
                </Show>

                <Show when={conflict() && statusItems().length > 0}>
                    <span style={WARNING_STYLE}>
                        ⚠ 下一P时间早于片段跳过结束，可能导致连续跳转。
                    </span>
                </Show>

                <Show when={uiState.ui.cloudLink}>
                    <a
                        href="#"
                        style={CLOUD_LINK_STYLE}
                        onMouseEnter={(event) => {
                            event.currentTarget.style.background =
                                "rgba(0,161,214,.16)";
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.background =
                                "rgba(0,161,214,.08)";
                        }}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            props.onOpenCloud();
                        }}
                    >
                        查看云端数据→
                    </a>
                </Show>
            </div>

            <div style={RIGHT_STYLE}>
                <Show when={uiState.ui.actionView}>
                    <ActionButton
                        label="片段查看"
                        variant="primary"
                        onClick={props.onView}
                    />
                </Show>
                <Show when={uiState.ui.actionSubmit}>
                    <ActionButton
                        label="片段设置"
                        variant="secondary"
                        onClick={props.onOpenSubmit}
                    />
                </Show>
            </div>
        </div>
    );
}
