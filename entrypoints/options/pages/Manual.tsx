// entrypoints/options/pages/Manual.tsx
import { HandFist } from "lucide-solid";
import { HistoryManager } from "@/components/HistoryManager";
import { MAX_HISTORY_LENGTH, PINNED_HISTORY_LENGTH } from "@/utils/bilibili";

export default function ManualPage() {
    return (
        <HistoryManager
            kind="pinned"
            title="手动存档管理"
            description="用户手动存档的视频，凡是存档的视频都是符合连播条件的。"
            emptyText="暂无手动记录，快去观看合集视频吧"
            confirmText="确定要清空所有手动历史记录吗？"
            icon={HandFist}
            hint={
                <>
                    <b>关于手动存档：</b>
                    在视频播放页点击插件图标，选择“手动存档”保存当前的片段配置和视频信息，方便下次使用。
                    Options 页面会保留最近的 {MAX_HISTORY_LENGTH} 条记录，
                    但 Popup 页面只会显示最新的 {PINNED_HISTORY_LENGTH} 条记录。
                </>
            }
        />
    );
}
