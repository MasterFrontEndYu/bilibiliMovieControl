// entrypoints/popup/App.tsx
import { Show, For, createSignal, Switch, Match, onSettled } from "solid-js";
import { TimeInput } from "@/components/TimeInput";
import { HistoryList } from "@/components/HistoryList";
import { browser } from "wxt/browser";
import {
    getSoftName,
    LATEST_HISTORY_LENGTH,
    PINNED_HISTORY_LENGTH,
} from "@/utils/bilibili";
import type { HistoryConfig } from "@/types/types";
import { useConfig, initGlobalConfig } from "@/hooks/useStorageConfig";
import { useNavigate } from "@solidjs/router";
import { RotateCcw, RotateCwClock, SaveCheck, Settings } from '@lucide/solid';

export default function Index() {
    const { config, update } = useConfig([
        "mode",
        "frameConfig",
        "jumpConfig",
        "opRanges",
        "isPageReady",
    ]);

    const [latestHistory, setLatestHistory] = createSignal<HistoryConfig[]>([]);
    const [pinnedHistory, setPinnedHistory] = createSignal<HistoryConfig[]>([]);

    const navigate = useNavigate();

    /**
     * 保存模式切换
     */
    const saveMode = async (newMode: "frame" | "manual") => {
        update({ mode: newMode });
    };

    /**
     * 应用配置：将当前所有状态写入 Storage 并广播给 Content Script
     */
    const applyConfig = async () => {
        const zero = { h: 0, m: 0, s: 0 };
        if (config.mode === "frame") {
            update({ frameConfig: zero });
        } else {
            update({ jumpConfig: zero });
        }
    };

    /**
     * 存档逻辑：将当前配置存入历史记录
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
                    mode: config.mode,
                    opRanges: config.opRanges,
                    frameConfig: config.frameConfig,
                    jumpConfig: config.jumpConfig,
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

    /**
     * 打开「多 OP 跳转时间段」独立页面
     * TODO: 等你把 TimeRangeManager 挪到独立页面后，改成真实 URL，例如 "/time-range.html"
     */
    const openTimeRangePage = () => {
        navigate("/open");
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
                <div class="flex items-center flex-1 font-bold">
                    <h1 class="flex flex-1 text-lg align-center">
                        {getSoftName()}
                    </h1>
                    <span
                        class={`badge badge-xs mr-4 items-center ${config.isPageReady ? "badge-success" : "badge-ghost"
                            }`}
                    >
                        <Show when={config.isPageReady}>
                            <div class="inline-grid *:[grid-area:1/1]">
                                <div class="status status-error animate-ping"></div>
                                <div class="status status-error"></div>
                            </div>
                        </Show>
                        <Show when={!config.isPageReady}>
                            <span class="status"></span>
                        </Show>
                        {config.isPageReady ? "已就绪" : "未启动"}
                    </span>
                </div>

                <button
                    class=" btn btn-outline btn-primary btn-xs"
                    onClick={openOptions}
                >
                    <Settings size={12} />
                    查看
                </button>
            </div>

            <div class="divider m-0">设置多OP跳转5</div>
            <button
                class="btn btn-dash btn-warning btn-sm btn-block"
                onClick={openTimeRangePage}
            >
                <RotateCwClock size={12} />
                管理多个跳过时间段
            </button>

            <div class="divider m-0">设置视频集合跳转</div>

            <div class="flex gap-3 justify-center">
                <For each={["frame", "manual"] as const}>
                    {(m) => (
                        <label
                            class={`flex items-center gap-1 cursor-pointer ${config.mode === m ? "text-secondary" : ""
                                }`}
                        >
                            <input
                                type="radio"
                                name="mode"
                                class="radio radio-xs radio-secondary"
                                checked={config.mode === m}
                                onChange={() => saveMode(m)}
                            />
                            {m === "frame" ? "帧分析" : "手动切集"}
                        </label>
                    )}
                </For>
            </div>

            <div class="flex flex-col gap-2.5">
                <Switch>
                    <Match when={config.mode === "frame"}>
                        <TimeInput
                            label="帧"
                            hour={config.frameConfig.h}
                            minute={config.frameConfig.m}
                            second={config.frameConfig.s}
                            onHourChange={(val) =>
                                update({
                                    frameConfig: {
                                        ...config.frameConfig,
                                        h: val,
                                    },
                                })
                            }
                            onMinuteChange={(val) =>
                                update({
                                    frameConfig: {
                                        ...config.frameConfig,
                                        m: val,
                                    },
                                })
                            }
                            onSecondChange={(val) =>
                                update({
                                    frameConfig: {
                                        ...config.frameConfig,
                                        s: val,
                                    },
                                })
                            }
                        />
                    </Match>
                    <Match when={config.mode === "manual"}>
                        <TimeInput
                            label="切"
                            hour={config.jumpConfig.h}
                            minute={config.jumpConfig.m}
                            second={config.jumpConfig.s}
                            onHourChange={(val) =>
                                update({
                                    jumpConfig: {
                                        ...config.jumpConfig,
                                        h: val,
                                    },
                                })
                            }
                            onMinuteChange={(val) =>
                                update({
                                    jumpConfig: {
                                        ...config.jumpConfig,
                                        m: val,
                                    },
                                })
                            }
                            onSecondChange={(val) =>
                                update({
                                    jumpConfig: {
                                        ...config.jumpConfig,
                                        s: val,
                                    },
                                })
                            }
                        />
                    </Match>
                </Switch>
            </div>

            <button class="btn btn-warning btn-sm w-full" onClick={applyConfig}>
                <RotateCcw size={12} />
                重置
            </button>

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
