// entrypoints/popup/App.tsx
import { onMount, Show, For, createSignal, Switch, Match } from "solid-js";
import { TimeInput } from "@/components/TimeInput";
import { HistoryList } from "@/components/HistoryList";
import { TimeRangeManager } from "@/components/TimeRangeList";
import { browser } from "wxt/browser";
import { Settings, Clock, Save, RotateCcw } from "lucide-solid";

import { getSoftName } from "@/utils/bili";
import { HistoryItem, TimeRange } from "@/types/types";
import { useStorageConfig } from "@/hooks/useStorageConfig";

// TODO 全局配置修改为，可以添加多个网页地址，让插件生效。目前只针对B站。

export default function App() {
    const {
        config,
        updateConfig,
        initFromStorage,
    } = useStorageConfig();

    const [showTimeManager, setShowTimeManager] = createSignal(false);
    const [latestHistory, setLatestHistory] = createSignal<HistoryItem[]>([]);
    const [pinnedHistory, setPinnedHistory] = createSignal<HistoryItem[]>([]);

    /**
     * 保存模式切换
     */

    const saveMode = async (newMode: "frame" | "manual") => {
        updateConfig({ mode: newMode });
    };

    /**
     * 应用配置：将当前所有状态写入 Storage 并广播给 Content Script
     */
    const applyConfig = async () => {
        const zero = { h: 0, m: 0, s: 0 };
        if (config.mode === "frame") {
            updateConfig({ frameConfig : zero});
        } else {
            updateConfig({ jumpConfig: zero });
        }
    };

    /**
     * 存档逻辑：将当前配置存入历史记录
     */
    const handleArchive = async () => {
        const activeTab = await getActiveTab();
      
        // 2. 校验逻辑依然保持，但代码更整洁
        if (!activeTab?.id) return;

        // 3. 发送存档请求
        const response = await browser.runtime.sendMessage({
            type: "DO_ARCHIVE",
            data: {
                // 这里利用 getActiveTab 返回的对象
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
     * 加载历史记录到当前页面
     */
    const loadHistory = async (item: HistoryItem) => {
        await browser.tabs.update({ url: item.url });
        window.close();
    };

    /**
     * 打开配置页
     */
    const openOptions = () => {
        browser.tabs.create({ url: browser.runtime.getURL("/options.html") });
    };

    onMount(async () => {
        await initFromStorage();

        const res = await browser.storage.local.get([
            "latestHistory",
            "pinnedHistory",
        ]);

        if (Array.isArray(res.latestHistory))
            setLatestHistory(res.latestHistory.slice(0, 2) as HistoryItem[]);
        if (Array.isArray(res.pinnedHistory))
            setPinnedHistory(res.pinnedHistory.slice(0, 3) as HistoryItem[]);

        await new Promise((resolve) => setTimeout(resolve, 5000));
    });

    return (
        <div class="card bg-base-100 shadow-xl rounded-box p-4 w-72 gap-3">
            <Show when={!showTimeManager()}>
                <div class="flex items-center justify-between">
                    <div class="flex items-center flex-1 font-bold">
                        <h1 class="flex flex-1 text-lg align-center">
                            {" "}
                            {getSoftName()}
                        </h1>
                        <span
                            class={`badge badge-xs mr-8 ${
                                config.isPageReady ? "badge-success" : "badge-ghost"
                            }`}
                        >
                            {config.isPageReady ? "已就绪" : "未启动"}
                        </span>
                    </div>

                    <button
                        class=" btn btn-outline btn-primary btn-xs"
                        onClick={openOptions}
                    >
                        <Settings size={12} />
                        详情
                    </button>
                </div>

                <div class="divider m-0">设置多OP跳转</div>
                <button
                    class="btn btn-dash btn-warning btn-block"
                    onClick={[setShowTimeManager, true]}
                >
                    {" "}
                    <Clock size={14} />
                    管理多个跳过时间段
                </button>

                <div class="divider m-0">设置视频集合跳转</div>

                <div class="flex gap-3 justify-center">
                    <For each={["frame", "manual"] as const}>
                        {(m) => (
                            <label
                                class={`flex items-center gap-1 cursor-pointer ${
                                    config.mode === m ? "text-secondary" : ""
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
                                // 必须通过展开运算符更新特定字段
                                onHourChange={(val) =>
                                    updateConfig({
                                        frameConfig: {
                                            ...config.frameConfig,  // 保留旧的 m 和 s
                                            h: val                  // 覆盖 h
                                        }
                                    })
                                    
                                }
                                onMinuteChange={(val) =>
                                    updateConfig({
                                        frameConfig: {
                                            ...config.frameConfig,  // 保留旧的 m 和 s
                                            m: val                  // 覆盖 h
                                        }
                                    })
                                }
                                onSecondChange={(val) =>
                                    updateConfig({
                                        frameConfig: {
                                            ...config.frameConfig,  // 保留旧的 m 和 s
                                            s: val                  // 覆盖 h
                                        }
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
                                    updateConfig({
                                        jumpConfig: {
                                            ...config.jumpConfig,  // 保留旧的 m 和 s
                                            h: val                  // 覆盖 h
                                        }
                                    })
                                }
                                onMinuteChange={(val) =>
                                updateConfig({
                                    jumpConfig: {
                                        ...config.jumpConfig,  // 保留旧的 m 和 s
                                        m: val                  // 覆盖 h
                                    }
                                })
                                }
                                onSecondChange={(val) =>
                                updateConfig({
                                    jumpConfig: {
                                        ...config.jumpConfig,  // 保留旧的 m 和 s
                                        s: val                  // 覆盖 h
                                    }
                                })
                                }
                            />
                        </Match>
                    </Switch>
                </div>

                <div class="flex justify-between gap-2">
                    <button
                        class="btn btn-soft btn-primary btn-sm"
                        onClick={handleArchive}
                    >
                        <Save size={14} /> 存档
                    </button>
                    <button
                        class="btn btn-soft btn-warning btn-sm"
                        onClick={applyConfig}
                    >
                        <RotateCcw size={14} /> 重置
                    </button>
                </div>

                <HistoryList
                    latest={latestHistory()}
                    pinned={pinnedHistory()}
                    onLoadHistory={loadHistory}
                />
            </Show>
            <Show when={showTimeManager()}>
                <TimeRangeManager
                    ranges={config.opRanges}
                    onUpdate={updateConfig}
                    onClose={() => setShowTimeManager(false)}
                />
            </Show>
        </div>
    );
}
