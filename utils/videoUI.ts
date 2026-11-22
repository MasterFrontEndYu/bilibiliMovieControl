import type {
    ActionButtonHandlers,
    ActionButtonVariant,
    ActionButtonsHandle,
    VideoUIConfig,
    VideoUIHandle,
} from "@/types/types";

const ACTION_BUTTON_STYLE =
    "box-sizing:border-box;height:18px;padding:0 8px;border-radius:5px;" +
    "font-size:11px;line-height:16px;cursor:pointer;font-family:sans-serif;" +
    "border:1px solid transparent;transition:background .15s,border-color .15s;";

/** 两种按钮的常态 / hover 配色 */
const ACTION_BUTTON_THEMES: Record<
    ActionButtonVariant,
    { normal: string; hover: string }
> = {
    primary: {
        normal: "background:#fb7299;color:#fff;border-color:#fb7299;",
        hover: "background:#f25d8b;border-color:#f25d8b;",
    },
    secondary: {
        normal: "background:#e6f4fe;color:#2d8ccf;border-color:#bfe2f7;",
        hover: "background:#d3ecfd;border-color:#a9d8f3;",
    },
};

/** 生成一个操作按钮（原生 DOM） */
function createButton(
    label: string,
    variant: ActionButtonVariant,
    onClick: () => void,
): HTMLButtonElement {
    const theme = ACTION_BUTTON_THEMES[variant];

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = ACTION_BUTTON_STYLE + theme.normal;

    button.addEventListener("mouseenter", () => {
        button.style.cssText = ACTION_BUTTON_STYLE + theme.hover;
    });
    button.addEventListener("mouseleave", () => {
        button.style.cssText = ACTION_BUTTON_STYLE + theme.normal;
    });
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });

    return button;
}

/**
 * 页面内的操作按钮组（查看列表 / 提交片段）。
 * 与左侧的状态条分置两端，由调用方决定挂到哪个容器。
 */
export function createActionButtons(
    host: HTMLElement,
    handlers: ActionButtonHandlers,
): ActionButtonsHandle {
    const viewButton = createButton("查看", "primary", handlers.onView);
    const submitButton = createButton("上传", "secondary", handlers.onSubmit);

    host.append(viewButton, submitButton);

    return {
        destroy: () => {
            viewButton.remove();
            submitButton.remove();
        },
    };
}

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

    const skip = document.createElement("span");
    skip.title = "OP 跳过段数";

    const divider = document.createElement("span");
    divider.style.cssText =
        "display:inline-block;width:2px;height:16px;background:rgba(255,255,255,.5);";

    const next = document.createElement("span");
    next.title = "到点切换下一 P 的片段数";

    badge.append(skip, divider, next);
    root.append(badge);
    container.append(root);

    const update = (cfg: VideoUIConfig) => {
        const segments = cfg.segments ?? [];
        const skipCount = segments.filter(
            (segment) => segment.kind === "skip",
        ).length;
        const nextCount = segments.filter(
            (segment) => segment.kind === "next",
        ).length;

        skip.textContent = `⏭ OP 跳过 ${skipCount} 段`;
        next.textContent = `🔚 下一 P ${nextCount} 个`;
    };

    return {
        update,
        destroy: () => root.remove(),
    };
}
