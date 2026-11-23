import { For, Show } from "solid-js";
import { MonitorCog, TriangleAlert } from "lucide-solid";
import { useUiConfig } from "@/hooks/useUiConfig";
import { DEFAULT_UI, isUiEmpty } from "@/utils/uiVisibility";
import type { UiVisibility } from "@/types/types";

interface UiRow {
    key: keyof UiVisibility;
    label: string;
    hint: string;
}

const ACTION_ROWS: UiRow[] = [
    {
        key: "actionView",
        label: "片段查看",
        hint: "播放页右侧的「片段查看」按钮，打开只读面板。",
    },
    {
        key: "actionSubmit",
        label: "片段设置",
        hint: "播放页右侧的「片段设置」按钮，用于新建、编辑、删除、上传片段。",
    },
    {
        key: "cloudLink",
        label: "查看云端数据",
        hint: "状态条旁的「查看云端数据→」链接，会带着当前 BV 打开云端片段页。",
    },
];

const STATUS_ROWS: UiRow[] = [
    {
        key: "statusSkip",
        label: "片段跳过数量",
        hint: "⏭ 片段跳过 N 段",
    },
    {
        key: "statusNext",
        label: "下一 P 时间",
        hint: "🔚 6:48:57（未设置片段时显示「未设置」）",
    },
    {
        key: "statusCloud",
        label: "云端片段数量",
        hint: "☁ 云端 N 个（云端片段关闭时显示「关」）",
    },
];

const Section = (props: {
    title: string;
    hint: string;
    rows: UiRow[];
    ui: UiVisibility;
    onToggle: (key: keyof UiVisibility) => void;
}) => (
    <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
        <div class="card-body gap-4 p-6">
            <div>
                <h2 class="card-title text-base font-bold text-base-content">
                    {props.title}
                </h2>
                <p class="text-sm text-base-content/60 m-0 mt-1 leading-relaxed">
                    {props.hint}
                </p>
            </div>

            <div class="flex flex-col gap-3">
                <For each={props.rows}>
                    {(row) => (
                        <label class="flex items-start justify-between gap-6 bg-base-200/60 rounded-xl p-4 cursor-pointer">
                            <span class="min-w-0">
                                <span class="block text-sm font-semibold text-base-content">
                                    {row.label}
                                </span>
                                <span class="block text-xs text-base-content/55 mt-1 leading-relaxed">
                                    {row.hint}
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                class="toggle toggle-primary shrink-0 mt-0.5"
                                checked={props.ui[row.key]}
                                onChange={() => props.onToggle(row.key)}
                            />
                        </label>
                    )}
                </For>
            </div>
        </div>
    </div>
);

export default function UiPage() {
    const { ui, update } = useUiConfig();

    const toggle = (key: keyof UiVisibility) => {
        void update({ [key]: !ui[key] });
    };

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <MonitorCog size={26} />
                        界面显示
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        决定播放页顶部那一行显示哪些内容。只影响显示，跳过、下一
                        P、云端查询等逻辑都不受影响。
                    </p>
                </div>
            </header>

            <Show when={isUiEmpty(ui)}>
                <div class="bg-warning/10 border border-warning/40 p-4 rounded-xl mb-8 flex gap-3 items-start">
                    <TriangleAlert
                        size={16}
                        class="text-warning shrink-0 mt-0.5"
                    />
                    <p class="m-0 text-sm text-base-content/80 leading-relaxed">
                        现在已全部隐藏：播放页不会再有插件入口，
                        <strong>但插件仍在后台工作</strong>
                        。需要改动片段时，可以从 Popup 的「片段查看 /
                        片段设置」打开浮动窗口。
                    </p>
                </div>
            </Show>

            <Section
                title="页面操作"
                hint="播放页右侧的按钮，以及状态条旁的云端数据入口。"
                rows={ACTION_ROWS}
                ui={ui}
                onToggle={toggle}
            />

            <Section
                title="状态条"
                hint="左侧彩色条里的三项统计；三项全部关闭时整条状态条不显示。"
                rows={STATUS_ROWS}
                ui={ui}
                onToggle={toggle}
            />

            <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-xs text-base-content/50 m-0">
                    悬浮面板内部的内容不受这里控制。
                </p>
                <button
                    class="btn btn-outline btn-sm"
                    onClick={() => void update(DEFAULT_UI)}
                >
                    恢复默认
                </button>
            </div>
        </div>
    );
}
