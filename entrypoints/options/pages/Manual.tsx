// entrypoints/options/pages/History.tsx
import { createSignal, onMount, For, Show } from "solid-js";
import { Trash2, ExternalLink, Info, HandGrab } from "lucide-solid";
import { browser } from "wxt/browser";

import { MAX_HISTORY_LENGTH } from "@/utils/bilibili";

// 定义和 Background/Popup 一致的接口
import type { HistoryConfig } from "@/types/types";

export default function HistoryPage() {
    const [pinnedHistory, setPinnedHistory] = createSignal<HistoryConfig[]>([]);

    // 初始化加载
    onMount(async () => {
        const res = await browser.storage.local.get({ pinnedHistory: [] });
        setPinnedHistory(res.pinnedHistory as HistoryConfig[]);
    });

    // 删除单条
    const deleteItem = async (url: string) => {
        const updated = pinnedHistory().filter((item) => item.url !== url);
        setPinnedHistory(updated);
        await browser.storage.local.set({ pinnedHistory: updated });
    };

    // 清空所有
    const clearAll = async () => {
        if (confirm("确定要清空所有手动历史记录吗？")) {
            setPinnedHistory([]);
            await browser.storage.local.set({ pinnedHistory: [] });
        }
    };

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl  mb-3 text-primary flex items-center gap-3">
                        <HandGrab size={36} /> 手动存档管理
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        用户手动存档的视频，凡是存档的视频都是符合状态设置的。
                    </p>
                </div>
                <Show when={pinnedHistory().length > 0}>
                    <button
                        onClick={clearAll}
                        class="btn btn-outline btn-error btn-sm"
                    >
                        清空记录
                    </button>
                </Show>
            </header>

            {/* 列表容器 */}
            <div class="flex flex-col gap-4">
                <For each={pinnedHistory()}>
                    {(item) => (
                        <div class="bg-base-100 p-5 rounded-xl flex justify-between items-center shadow-sm border border-base-300">
                            <div class="flex-1">
                                <div class="font-bold text-base mb-2 text-base-content">
                                    {item.title}
                                </div>
                                <div class="flex gap-5 text-sm text-base-content/70">
                                    <span>
                                        ⏱️ 跳过: {item.frameConfig.m}分
                                        {item.frameConfig.s}秒 -{" "}
                                        {item.frameConfig.m}分
                                        {item.frameConfig.s}秒
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
                                    class="btn btn-primary btn-sm"
                                >
                                    <ExternalLink size={16} /> 回看
                                </a>
                                <button
                                    onClick={() => deleteItem(item.url)}
                                    class="btn btn-ghost btn-sm text-base-content/50"
                                    title="删除此条记录"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </For>

                {/* 空状态 */}
                <Show when={pinnedHistory().length === 0}>
                    <div class="text-center py-20 bg-base-100 rounded-2xl border-2 border-dashed border-base-300">
                        <div class="text-4xl mb-4">📄</div>
                        <p class="text-base-content/50 m-0">
                            暂无手动记录，快去观看合集视频吧
                        </p>
                    </div>
                </Show>
            </div>

            {/* 底部提示 */}
            <div class="mt-8 p-4 bg-info/10 border border-info/20 rounded-xl flex gap-2.5 items-start">
                <Info size={18} class="text-info shrink-0 mt-0.5" />
                <p class="m-0 text-xs text-base-content/70 leading-relaxed">
                    <b>关于手动存档：</b>
                    用户可以在视频播放过程中点击插件图标，选择“手动存档”来保存当前的跳过配置和视频信息，以便下次直接使用。
                    Options 页面会保留最近的 {MAX_HISTORY_LENGTH} 条记录。
                    但popup页面只会显示最新的 {PINNED_HISTORY_LENGTH} 条记录
                </p>
            </div>
        </div>
    );
}
