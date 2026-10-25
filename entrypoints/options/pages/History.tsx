// entrypoints/options/pages/History.tsx
import { createSignal, For, onSettled, Show } from "solid-js";
import { browser } from "wxt/browser";

import { MAX_HISTORY_LENGTH, LATEST_HISTORY_LENGTH } from "@/utils/bilibili";

import type { HistoryConfig } from "@/types/types";
import { RobotVacuum, ScanEye, Trash } from "@lucide/solid";

export default function HistoryPage() {
    const [historyList, setHistoryList] = createSignal<HistoryConfig[]>([]);

    // 初始化加载
    onSettled(() => {
        let alive = true;
        (async () => {
            try {
                const res = await browser.storage.local.get({ latestHistory: [] });
                if (alive) setHistoryList(res.latestHistory as HistoryConfig[]);
            } catch (err) {
                console.error("[History] 初始化读取失败:", (err as Error)?.cause ?? err);
            }
        })();
        return () => {
            alive = false;
        };
    });

    // 删除单条
    const deleteItem = async (url: string) => {
        const prev = historyList();
        const updated = prev.filter(item => item.url !== url);
        setHistoryList(updated);
        try {
            await browser.storage.local.set({ latestHistory: updated });
        } catch (err) {
            console.error("[History] 删除保存失败:", (err as Error)?.cause ?? err);
            setHistoryList(prev); // 回滚
        }
    };

    // 清空所有
    const clearAll = async () => {
        if (confirm('确定要清空所有自动历史记录吗？')) {
            const prev = historyList();
            setHistoryList([]);
            try {
                await browser.storage.local.set({ latestHistory: [] });
            } catch (err) {
                console.error("[History] 清空保存失败:", (err as Error)?.cause ?? err);
                setHistoryList(prev); // 回滚
            }
        }
    };

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <RobotVacuum size={26} />
                        自动存档管理
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        系统会自动记录符合连播条件的视频配置，方便下次直接使用。
                    </p>
                </div>
                <Show when={historyList().length > 0}>
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
                <For each={historyList()}>
                    {(item) => (
                        <div class="bg-base-100 p-5 rounded-xl flex justify-between items-center shadow-sm border border-base-300">
                            <div class="flex-1">
                                <div class="font-bold text-base mb-2 text-base-content">
                                    {item.title}
                                </div>
                                <div class="flex gap-5 text-sm text-base-content/70">
                                    <span>⏱️ 跳过: {item.frameConfig.m}分{item.frameConfig.s}秒 - {item.frameConfig.m}分{item.frameConfig.s}秒</span>
                                    <span>📅 记录于: {new Date(item.time).toLocaleString()}</span>
                                </div>
                            </div>

                            <div class="flex gap-3 ml-5">
                                <a
                                    href={item.url} target="_blank"
                                    class="btn btn-primary btn-sm"
                                >
                                    <ScanEye size={12} />

                                    回看
                                </a>
                                <button
                                    onClick={() => deleteItem(item.url)}
                                    class="btn btn-ghost btn-sm text-base-content/50"
                                    title="删除此条记录"
                                >
                                    <Trash size={12} />
                                </button>
                            </div>
                        </div>
                    )}
                </For>

                {/* 空状态 */}
                <Show when={historyList().length === 0}>
                    <div class="text-center py-20 bg-base-100 rounded-2xl border-2 border-dashed border-base-300">
                        <div class="text-4xl mb-4">📄</div>
                        <p class="text-base-content/50 m-0">暂无自动记录，快去观看合集视频吧</p>
                    </div>
                </Show>
            </div>

            {/* 底部提示 */}
            <div class="mt-8 p-4 bg-info/10 border border-info/20 rounded-xl flex gap-2.5 items-start">
                <p class="m-0 text-xs text-base-content/70 leading-relaxed">
                    <b>关于自动存档：</b> 插件会在后台检测到视频为“合集/列表”且符合读帧条件时自动创建此记录。
                    Options 页面会保留最近的 {MAX_HISTORY_LENGTH} 条记录。
                    但popup页面只会显示最新的 {LATEST_HISTORY_LENGTH} 条记录
                </p>
            </div>
        </div>
    );
}