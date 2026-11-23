import {
    For,
    Show,
    createSignal,
    onCleanup,
    onMount,
    type Component,
    type JSX,
} from "solid-js";
import { browser } from "wxt/browser";
import type { LucideProps } from "lucide-solid";
import { ScanEye, Trash } from "lucide-solid";
import {
    clearHistory,
    historyStorageKey,
    readHistory,
    removeHistoryItem,
} from "@/utils/history";
import type { HistoryConfig, HistoryKind } from "@/types/types";

export interface HistoryManagerProps {
    kind: HistoryKind;
    title: string;
    description: string;
    emptyText: string;
    confirmText: string;
    icon: Component<LucideProps>;
    /** 页面底部说明 */
    hint: JSX.Element;
}

/**
 * 自动存档 / 手动存档共用的管理页：
 * 读取、删除、清空统一走 utils/history，避免两份页面各写一套读改写逻辑。
 */
export function HistoryManager(props: HistoryManagerProps) {
    const [items, setItems] = createSignal<HistoryConfig[]>([]);
    const [error, setError] = createSignal("");

    const refresh = async () => {
        setItems(await readHistory(props.kind));
    };

    onMount(() => {
        void refresh();

        const onChanged = (changes: Record<string, unknown>, area: string) => {
            if (area !== "local") return;
            if (!changes[historyStorageKey(props.kind)]) return;
            void refresh();
        };

        browser.storage.onChanged.addListener(onChanged);
        onCleanup(() => browser.storage.onChanged.removeListener(onChanged));
    });

    const removeItem = async (url: string) => {
        setError("");
        try {
            setItems(await removeHistoryItem(props.kind, url));
        } catch {
            setError("删除失败，请重试");
        }
    };

    const clearAll = async () => {
        if (!confirm(props.confirmText)) return;

        setError("");
        try {
            await clearHistory(props.kind);
            setItems([]);
        } catch {
            setError("清空失败，请重试");
        }
    };

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <props.icon size={26} />
                        {props.title}
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        {props.description}
                    </p>
                </div>
                <Show when={items().length > 0}>
                    <button
                        onClick={clearAll}
                        class="btn btn-outline btn-error btn-sm"
                    >
                        清空记录
                    </button>
                </Show>
            </header>

            <Show when={error()}>
                <p class="text-sm text-error mb-4">{error()}</p>
            </Show>

            <div class="flex flex-col gap-4">
                <For each={items()}>
                    {(item) => (
                        <div class="bg-base-100 p-5 rounded-xl flex justify-between items-center shadow-sm border border-base-300">
                            <div class="flex-1">
                                <div class="font-bold text-base mb-2 text-base-content">
                                    {item.title}
                                </div>
                                <div class="flex gap-5 text-sm text-base-content/70">
                                    <span>
                                        ⏱️ 片段: {item.segments?.length ?? 0} 个
                                    </span>
                                    <span>
                                        📅 记录于:{" "}
                                        {new Date(item.time).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div class="flex gap-3 ml-5">
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-primary btn-sm"
                                >
                                    <ScanEye size={12} />
                                    回看
                                </a>
                                <button
                                    onClick={() => void removeItem(item.url)}
                                    class="btn btn-ghost btn-sm text-base-content/50"
                                    title="删除此条记录"
                                >
                                    <Trash size={12} />
                                </button>
                            </div>
                        </div>
                    )}
                </For>

                <Show when={items().length === 0}>
                    <div class="text-center py-20 bg-base-100 rounded-2xl border-2 border-dashed border-base-300">
                        <div class="text-4xl mb-4">📄</div>
                        <p class="text-base-content/50 m-0">
                            {props.emptyText}
                        </p>
                    </div>
                </Show>
            </div>

            <div class="mt-8 p-4 bg-base-200/60 rounded-xl">
                <p class="m-0 text-xs text-base-content/60 leading-relaxed">
                    {props.hint}
                </p>
            </div>
        </div>
    );
}
