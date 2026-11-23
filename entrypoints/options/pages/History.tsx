// entrypoints/options/pages/History.tsx
import { RobotVacuum } from "lucide-solid";
import { HistoryManager } from "@/components/HistoryManager";
import { LATEST_HISTORY_LENGTH, MAX_HISTORY_LENGTH } from "@/utils/bilibili";

export default function HistoryPage() {
    return (
        <HistoryManager
            kind="latest"
            title="自动存档管理"
            description="系统会自动记录符合连播条件的视频配置，方便下次直接使用。"
            emptyText="暂无自动记录，快去观看合集视频吧"
            confirmText="确定要清空所有自动历史记录吗？"
            icon={RobotVacuum}
            hint={
                <>
                    <b>关于自动存档：</b>{" "}
                    插件检测到视频为“合集/列表”后会自动创建此记录。 Options
                    页面会保留最近的 {MAX_HISTORY_LENGTH} 条记录， Popup
                    只会显示最新的 {LATEST_HISTORY_LENGTH} 条。
                </>
            }
        />
    );
}
