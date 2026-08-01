import { Component, For } from 'solid-js';
import { HistoryConfig, HistoryListConfig } from '@/types/types';

export const HistoryList: Component<HistoryListConfig> = (props) => {
    const loadHistory = async (item: HistoryConfig) => {
        await browser.tabs.update({ url: item.url });
        window.close();
    };
    console.log('pro', props.items);
    const prefix = () => (props.isPinned ? '📌 ' : '🕒 ');
    return (
        <div class="border-base-300">
            <div class="text-[12px] text-base-content/60 block mb-1">
                {props.isPinned ? '手动存档' : '最近播放'}
            </div>
            <div
                class="border border-base-300 rounded-md flex flex-col p-1 divide-y divide-base-300 overflow-hidden"
                style={{ height: `${props.maxLength * 32}px` }}
            >
                <For each={props.items} fallback={<div class="text-base-content/60 text-xs my-1 text-center">暂无记录</div>}>
                    {item => (
                        <div
                            class={`px-2 flex-1 flex items-center text-[11px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap transition-all duration-200 hover:shadow-sm ${props.isPinned
                                    ? 'bg-primary/10 text-secondary-content/70 hover:bg-primary/20 hover:text-primary'
                                : 'bg-secondary/10 text-secondary-content/70 hover:bg-secondary/20 hover:text-primary'
                                }`}
                            onClick={() => loadHistory(item)}
                        >
                            {prefix()}{item.title}
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};