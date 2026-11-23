// entrypoints/popup/App.tsx
import { Show, createSignal, onMount } from "solid-js";
import { HistoryList } from "@/components/HistoryList";
import { browser } from "wxt/browser";
import {
    getActiveTab,
    getBvidFromUrl,
    getSoftName,
    LATEST_HISTORY_LENGTH,
    PINNED_HISTORY_LENGTH,
} from "@/utils/bilibili";
import type { HistoryConfig, JumpPanelTab } from "@/types/types";
import { useConfig, initGlobalConfig } from "@/hooks/useStorageConfig";
import { Eye, SaveCheck, Settings, SlidersHorizontal } from "lucide-solid";

export default function Index() {
    const { config } = useConfig(["segments"]);

    const [latestHistory, setLatestHistory] = createSignal<HistoryConfig[]>([]);
    const [pinnedHistory, setPinnedHistory] = createSignal<HistoryConfig[]>([]);
    const [panelHint, setPanelHint] = createSignal("");

    /**
     * 在当前播放页打开内容脚本的浮动窗口：
     * view = 片段查看，submit = 片段设置
     */
    const openPanel = async (tab: JumpPanelTab) => {
        setPanelHint("");

        const activeTab = await getActiveTab();
        if (!activeTab?.id || !getBvidFromUrl(activeTab.url ?? "")) {
            setPanelHint("请在 B 站视频播放页使用");
            return;
        }

        try {
            const result = (await browser.tabs.sendMessage(activeTab.id, {
                type: "OPEN_PANEL",
                data: { tab },
            })) as { ok?: boolean; reason?: string } | undefined;

            if (!result?.ok) {
                setPanelHint(
                    result?.reason === "not-collection"
                        ? "当前页面不是合集，插件暂不生效"
                        : "播放器还没加载好，请稍后重试",
                );
                return;
            }

            window.close();
        } catch {
            setPanelHint("播放页脚本未加载，请刷新页面后重试");
        }
    };

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

    onMount(() => {
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
                    详情查看
                </button>
            </div>

            <p class="text-[11px] text-base-content/60 m-0 -mb-1">
                在播放页打开片段面板（需在 B 站视频页）
            </p>

            <div class="flex gap-2">
                <button
                    class="btn btn-primary btn-sm flex-1"
                    onClick={() => void openPanel("view")}
                >
                    <Eye size={12} />
                    片段查看
                </button>
                <button
                    class="btn btn-outline btn-primary btn-sm flex-1"
                    onClick={() => void openPanel("submit")}
                >
                    <SlidersHorizontal size={12} />
                    片段设置
                </button>
            </div>

            <Show when={panelHint()}>
                <p class="text-[11px] text-error m-0 -mt-1">
                    {panelHint()}
                </p>
            </Show>

            <HistoryList
                items={latestHistory()}
                maxLength={LATEST_HISTORY_LENGTH}
                isPinned={false}
            />
            <HistoryList
                items={pinnedHistory()}
                maxLength={PINNED_HISTORY_LENGTH}
                isPinned={true}
            />
            <button class="btn btn-primary btn-sm w-full" onClick={handleArchive}>
                <SaveCheck size={12} />
                手动存档
            </button>
        </>
    );
}
