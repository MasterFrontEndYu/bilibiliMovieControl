import { type Component, For } from 'solid-js';
import type { HistoryConfig, HistoryListConfig } from '@/types/types';

export const HistoryList: Component<HistoryListConfig> = (props) => {
    const loadHistory = async (item: HistoryConfig) => {
        await browser.tabs.update({ url: item.url });
        window.close();
    };

    const openOptions = (isPinned: boolean) => {
        browser.tabs.create({ url: browser.runtime.getURL(`/options.html?target=${isPinned ? "manual" : "history"}`) });
    };

    const prefix = () => (props.isPinned ? '📌 ' : '🕒 ');
    return (
        <div class="">
            <div class="text-[12px] text-base-content/60 flex justify-between mb-1">
                <span>{props.isPinned ? '手动存档' : '最近播放'}</span>
                <span class="text-primary hover:text-primary/80 cursor-pointer" onClick={() => openOptions(props.isPinned)}>
                    更多
                </span>
            </div>
            <div
                class="border border-base-300 w-full rounded-md flex flex-col p-1 overflow-hidden"
                style={{ height: `${props.maxLength * 32}px`, gap: '3px' }}
            >
                <For each={props.items} fallback={<div class="text-base-content/60 text-xs my-1 text-center">暂无记录</div>}>
                    {item => (
                        <div
                            class={`w-61.5 h-8 px-2 flex items-center text-[12px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap transition-all duration-200 hover:shadow-sm rounded ${props.isPinned
                                    ? 'bg-primary/10 hover:bg-primary/20 hover:text-primary'
                                    : 'bg-secondary/10 hover:bg-secondary/20 hover:text-primary'
                                }`}
                            onClick={() => loadHistory(item)}
                            title={item.title}
                        >
                            <span class="overflow-hidden text-ellipsis whitespace-nowrap">
                                {prefix()}{item.title}
                            </span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};