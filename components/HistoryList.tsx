import { Component, For } from 'solid-js';
import type { HistoryItem } from '../assets/types';
import { HistoryItemComp } from './HistoryItem';

interface HistoryListProps {
    latest: HistoryItem[];
    pinned: HistoryItem[];
    onLoadHistory: (item: HistoryItem) => void;
}

export const HistoryList: Component<HistoryListProps> = (props) => {
    return (
        <div class="mt-1 border-t border-base-300 pt-2.5">
            {/* 最近播放部分 */}
            <div class="text-[11px] text-base-content/60 mb-1 block">最近播放 (合集)</div>
            <div class="h-20 border border-base-300 rounded-md p-1 overflow-y-auto">
                <For each={props.latest} fallback={<div class="text-base-content/60 text-xs my-1 text-center">暂无记录</div>}>
                    {item => <HistoryItemComp item={item} onClick={props.onLoadHistory} isPinned={false} />}
                </For>
            </div> 

            {/* 手动存档部分 */}
            <div class="text-[11px] text-base-content/60 mb-1 block mt-2">手动存档</div>
            <div class="h-28 border border-base-300 rounded-md p-1 overflow-y-auto">
                <For each={props.pinned} fallback={<div class="text-base-content/60 text-xs py-2 text-center">暂无存档</div>}>
                    {item => <HistoryItemComp item={item} onClick={props.onLoadHistory} isPinned={true} />}
                </For>
            </div>
        </div>
    );
};