import { Component, For } from 'solid-js';
import type { HistoryConfig } from '@/types/types';
import { HistoryItemComp } from './HistoryItem';

interface HistoryListProps {
    history: HistoryConfig[];
    onLoadHistory: (item: HistoryConfig) => void;
}

export const HistoryList: Component<HistoryListProps> = (props) => {
    return (
        <div class="mt-1 border-t border-base-300 pt-2.5">
            <div class="text-[11px] text-base-content/60 mb-1 block">最近播放 (合集)</div>
            <div class="h-20 border border-base-300 rounded-md p-1 overflow-y-auto">
                <For each={props.history} fallback={<div class="text-base-content/60 text-xs my-1 text-center">暂无记录</div>}>
                    {item => <HistoryItemComp item={item} onClick={props.onLoadHistory} isPinned={false} />}
                </For>
            </div> 
        </div>
    );
};