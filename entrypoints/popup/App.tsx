// entrypoints/popup/App.tsx
import { onMount, Show, For, createSignal, Switch, Match } from "solid-js";
import { useBiliConfig } from "@/hooks/useBiliConfig";
import { TimeInput } from "@/components/TimeInput";
import { HistoryList } from "@/components/HistoryList";
import { TimeRangeManager } from "@/components/TimeRangeList";
import { browser } from "wxt/browser";
import { Settings, Clock, Save, RotateCcw } from "lucide-solid";

import { getSoftName } from "@/utils/bili";

// TODO 全局配置修改为，可以添加多个网页地址，让插件生效。目前只针对B站。

export default function App() {
    const {
        opRanges,
        frameConfig,
        setFrameConfig,
        jumpConfig,
        setJumpConfig,
        mode,
        isPageReady,
        setIsPageReady,
        latestHistory,
        setLatestHistory,
        pinnedHistory,

        // 方法
        initFromStorage,
        saveMode,
        applyConfig,
        handleArchive,
        loadHistory,
        openOptions,
        handleUpdateOpRanges,
    } = useBiliConfig();

    const [showTimeManager, setShowTimeManager] = createSignal(false);

    onMount(async () => {
        await initFromStorage();

        // 监听后台的自动更新广播
        browser.runtime.onMessage.addListener((msg) => {
            if (msg.type === "SYNC_PAGE_READY") {
                setIsPageReady(msg.isCollection);
            }
            if (msg.type === "REFRESH_HISTORY") setLatestHistory(msg.data);
        });
    });

    return (
        <div class="card bg-base-100 shadow-xl rounded-box p-4 w-72 gap-3">

            <Show when={!showTimeManager()}>
                <div class="flex items-center justify-between">
                    <div class="flex items-center flex-1 font-bold">
                        <h1 class="flex flex-1 text-lg align-center"> {getSoftName()}</h1>
                        <span
                            class={`badge badge-xs mr-8 ${isPageReady() ? "badge-success" : "badge-ghost"
                                }`}
                        >
                            {isPageReady() ? "已就绪" : "未启动"}
                        </span>
                    </div>

                    <button
                        class=" btn btn-outline btn-primary btn-xs"
                        onClick={openOptions}
                    >
                        <Settings size={12} />
                        设置
                    </button>
                </div>

                <div class="divider m-0">设置多OP跳转</div>
                <button class="btn btn-dash btn-warning btn-block" onClick={[setShowTimeManager, true]}> <Clock size={14} />管理多个跳过时间段</button>

                <div class="divider m-0">设置视频集合跳转</div>

                <div class="flex gap-3 justify-center">
                    <For each={["frame", "manual"] as const}>
                        {(m) => (
                            <label class={`flex items-center gap-1 cursor-pointer ${mode() === m ? "text-secondary" : ""}`}>
                                <input
                                    type="radio"
                                    name="mode"
                                    class="radio radio-xs radio-secondary"
                                    checked={mode() === m}
                                    onChange={() => saveMode(m)}
                                />
                                {m === "frame" ? "帧分析" : "手动切集"}
                            </label>
                        )}
                    </For>
                </div>
                <div class="flex flex-col gap-2.5">
                    <Switch>
                        <Match when={mode() === "frame"}>
                            <TimeInput
                                label="帧"
                                hour={frameConfig().h}
                                minute={frameConfig().m}
                                second={frameConfig().s}
                                // 必须通过展开运算符更新特定字段
                                onHourChange={(val) =>
                                    setFrameConfig({ ...frameConfig(), h: val })
                                }
                                onMinuteChange={(val) =>
                                    setFrameConfig({ ...frameConfig(), m: val })
                                }
                                onSecondChange={(val) =>
                                    setFrameConfig({ ...frameConfig(), s: val })
                                }
                            />
                        </Match>
                        <Match when={mode() === "manual"}>
                            <TimeInput
                                label="切"
                                hour={jumpConfig().h}
                                minute={jumpConfig().m}
                                second={jumpConfig().s}
                                onHourChange={(val) =>
                                    setJumpConfig({ ...jumpConfig(), h: val })
                                }
                                onMinuteChange={(val) =>
                                    setJumpConfig({ ...jumpConfig(), m: val })
                                }
                                onSecondChange={(val) =>
                                    setJumpConfig({ ...jumpConfig(), s: val })
                                }
                            />
                        </Match>
                    </Switch>
                </div>

                <div class="flex justify-between gap-2">
                    <button class="btn btn-soft btn-secondary btn-sm" onClick={[applyConfig, "setting"]}><Settings size={14} /> 应用</button>
                    <button class="btn btn-soft btn-warning btn-sm" onClick={[applyConfig, "reset"]}><RotateCcw size={14} /> 重置</button>
                    <button class="btn btn-soft btn-primary btn-sm" onClick={handleArchive}><Save size={14} /> 存档</button>
                </div>

                <HistoryList
                    latest={latestHistory()}
                    pinned={pinnedHistory()}
                    onLoadHistory={loadHistory}
                />
            </Show>
            <Show when={showTimeManager()}>
                <TimeRangeManager
                    ranges={opRanges()}
                    onUpdate={handleUpdateOpRanges}
                    onClose={() => setShowTimeManager(false)}
                />
            </Show>
        </div>
    );
}
