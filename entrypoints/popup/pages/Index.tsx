// entrypoints/popup/App.tsx
import { createSignal, onSettled } from "solid-js";
import { HistoryList } from "@/components/HistoryList";
import { browser } from "wxt/browser";
import {
    getSoftName,
    LATEST_HISTORY_LENGTH,
    PINNED_HISTORY_LENGTH,
} from "@/utils/bilibili";
import type { HistoryConfig } from "@/types/types";
import { useConfig, initGlobalConfig } from "@/hooks/useStorageConfig";
import { SaveCheck, Settings } from "@lucide/solid";

export default function Index() {
    const { config } = useConfig(["segments"]);

    const [latestHistory, setLatestHistory] = createSignal<HistoryConfig[]>([]);
    const [pinnedHistory, setPinnedHistory] = createSignal<HistoryConfig[]>([]);

    const skipCount = () =>
        config.segments.filter((segment) => segment.kind === "skip").length;
    const nextCount = () =>
        config.segments.filter((segment) => segment.kind === "next").length;

    /**
     * 存档逻辑：将当前片段配置存入历史记录
     */
    const handleArchive = async () => {
        const activeTab = await getActiveTab();
        if (!activeTab?.id) return;

        const response = await browser.runtime.sendMessage({
            type: "DO_ARCHIVE",
            data: {
                tab: {
                    id: activeTab.id,
                    title: activeTab.title,
                    url: activeTab.url,
                },
                config: {
                    segments: config.segments,
                },
            },
        });

        if (response?.pinnedHistory) {
            setPinnedHistory(response.pinnedHistory);
        }
    };

    /**
     * 打开配置页
     */
    const openOptions = () => {
        browser.tabs.create({ url: browser.runtime.getURL("/options.html") });
    };

    onSettled(() => {
        (async () => {
            await initGlobalConfig();
            const res = await browser.storage.local.get([
                "latestHistory",
                "pinnedHistory",
            ]);
            if (Array.isArray(res.latestHistory))
                setLatestHistory(res.latestHistory.slice(0, 2) as HistoryConfig[]);
            if (Array.isArray(res.pinnedHistory))
                setPinnedHistory(res.pinnedHistory.slice(0, 3) as HistoryConfig[]);
        })();
    });

    return (
        <>
            <div class="flex items-center justify-between">
                <h1 class="text-base align-center font-bold">
                    {getSoftName()}
                </h1>
                <button
                    class=" btn btn-outline btn-primary btn-xs"
                    onClick={openOptions}
                >
                    <Settings size={12} />
                    查看
                </button>
            </div>

            <div class="divider m-0">片段概览</div>

            <div class="bg-base-200/60 rounded-xl p-3 text-xs text-base-content/70 flex flex-col gap-1">
                <div class="flex justify-between">
                    <span>片段跳过</span>
                    <span class="font-mono">{skipCount()} 个</span>
                </div>
                <div class="flex justify-between">
                    <span>下一 P</span>
                    <span class="font-mono">{nextCount()} 个</span>
                </div>
                <div class="text-base-content/45 mt-1">
                    在播放页点「设置」可新增、编辑、删除片段
                </div>
            </div>

            <HistoryList
                items={latestHistory()}
                maxLength={LATEST_HISTORY_LENGTH}
                isPinned={false}
            />
            <button class="btn btn-primary btn-sm w-full" onClick={handleArchive}>
                <SaveCheck size={12} />
                手动存档
            </button>
            <HistoryList
                items={pinnedHistory()}
                maxLength={PINNED_HISTORY_LENGTH}
                isPinned={true}
            />
        </>
    );
}
