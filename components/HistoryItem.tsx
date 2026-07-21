import { Component } from 'solid-js';
import type { HistoryItem } from '../assets/types';

interface HistoryItemProps {
    item: HistoryItem;
    onClick: (item: HistoryItem) => void;
    isPinned?: boolean;
}

export const HistoryItemComp: Component<HistoryItemProps> = (props) => {
  const prefix = () => (props.isPinned ? '📌 ' : '🕒 ');

  return (
    <div
      class={`px-2 h-7 flex items-center text-[11px] cursor-pointer rounded-md overflow-hidden text-ellipsis whitespace-nowrap border my-1 transition-all duration-200 hover:shadow-sm ${
        props.isPinned
          ? 'bg-primary/10 border-primary/20 text-secondary-content/70 hover:bg-primary/20 hover:text-primary'
          : 'bg-secondary-200 border-secondary-300 text-secondary-content/70 hover:bg-secondary-300 hover:text-secondary-content'
      }`}
      onClick={() => props.onClick(props.item)}
    >
      {prefix()}{props.item.title}
    </div>
  );
};