// entrypoints/time-range/App.tsx
import { createSignal, For } from "solid-js";
import { TimeInput } from "@/components/TimeInput";
import type { TimeRange } from "@/types/types";
import { formatTime } from "@/utils/bilibili";
import { useConfig } from "@/hooks/useStorageConfig";
import { CircleX, Clock, RotateCcw, SaveCheck, Trash } from "@lucide/solid";
import { useNavigate } from "@solidjs/router";

// ⚠️ TimeRange 类型假设为 { id: string; start: TimeParts; end: TimeParts }
//    TimeParts = { h: number; m: number; s: number }
//    如果你的类型不同，把下面的 toSec / 拷贝逻辑对应调整

type TimeParts = { h: number; m: number; s: number };

const ZERO: TimeParts = { h: 0, m: 0, s: 0 };
const toSec = (t: TimeParts) => t.h * 3600 + t.m * 60 + t.s;

export default function Open() {
    const { config, update } = useConfig(["opRanges"]);

    // 编辑区状态
    const [currentId, setCurrentId] = createSignal<string | null>(null);
    const [currentStart, setCurrentStart] = createSignal<TimeParts>({ ...ZERO });
    const [currentEnd, setCurrentEnd] = createSignal<TimeParts>({ ...ZERO });

    const navigate = useNavigate();

    /**
     * 点击列表项 → 把该时段加载到编辑区
     */
    const handleSelect = (range: TimeRange) => {
        setCurrentId(range.id);
        setCurrentStart({ ...range.start });
        setCurrentEnd({ ...range.end });
    };

    /**
     * 删除某个时段
     */
    const handleRemove = (id: string) => {
        const next = config.opRanges.filter((r) => r.id !== id);
        update({ opRanges: next });
        if (currentId() === id) {
            handleResetInput();
        }
    };

    /**
     * 保存：新增或更新当前编辑的时段
     */
    const handleConfirm = () => {
        const start = currentStart();
        const end = currentEnd();

        // 基本校验：结束时间必须晚于开始时间
        if (toSec(end) <= toSec(start)) {
            // 你可换成 toast / alert
            console.warn("结束时间必须晚于开始时间");
            return;
        }

        const list = config.opRanges.slice();
        const editingId = currentId();

        if (editingId) {
            // 更新已有项
            const idx = list.findIndex((r) => r.id === editingId);
            if (idx >= 0) {
                list[idx] = { id: editingId, start, end };
                update({ opRanges: list });
                return;
            }
        }

        // 新增
        const newRange: TimeRange = {
            id: crypto.randomUUID(),
            start,
            end,
        };
        list.push(newRange);
        update({ opRanges: list });
        setCurrentId(newRange.id);
    };

    /**
     * 重置编辑区（不影响已保存列表）
     */
    const handleResetInput = () => {
        setCurrentId(null);
        setCurrentStart({ ...ZERO });
        setCurrentEnd({ ...ZERO });
    };

    /**
     * 关闭当前页面（独立 tab 页面可自关闭）
     */
    const handleClose = () => {
        navigate("/");
    };

    return (
        <div class="card rounded-box flex flex-col w-full h-full">
            {/* 1. 顶部列表 */}
            <div class="text-center text-lg font-bold text-primary leading-9">
                设置OP跳转时间段
            </div>
            <div class="bg-base-200 p-2 mt-5 flex flex-col gap-1 rounded-box">
                <div class="text-xs font-bold text-base-content/60 mb-1 pl-1">
                    已保存的时段 ({config.opRanges.length})
                </div>
                <div class="overflow-y-auto h-48">
                    <For
                        each={config.opRanges}
                        fallback={
                            <div class="m-auto pl-1 text-base-content/30 text-xs">
                                暂无跳过时段
                            </div>
                        }
                    >
                        {(range) => (
                            <div
                                onClick={() => handleSelect(range)}
                                class={`flex justify-between items-center px-2.5 py-1 bg-base-100 border ${range.id == currentId()
                                        ? "border-primary "
                                        : "border-base-300"
                                    } rounded-md cursor-pointer transition-all duration-200 hover:border-primary`}
                            >
                                <span class="text-sm text-base-content/70 font-mono">
                                    {formatTime(range.start)} -{" "}
                                    {formatTime(range.end)}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(range.id);
                                    }}
                                    class="btn btn-ghost btn-xs text-base-content/50"
                                >
                                    <Trash size={12} />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* 2. 中间编辑区 */}
            <div class="p-3 mt-4 bg-primary/5 flex flex-col gap-2.5 rounded-box">
                <div class="text-xs font-bold text-primary flex items-center gap-1">
                    <Clock size={12} />
                    设定新时段
                </div>

                <TimeInput
                    label="从"
                    hour={currentStart().h}
                    minute={currentStart().m}
                    second={currentStart().s}
                    onHourChange={(v) =>
                        setCurrentStart({ ...currentStart(), h: v })
                    }
                    onMinuteChange={(v) =>
                        setCurrentStart({ ...currentStart(), m: v })
                    }
                    onSecondChange={(v) =>
                        setCurrentStart({ ...currentStart(), s: v })
                    }
                />

                <TimeInput
                    label="至"
                    hour={currentEnd().h}
                    minute={currentEnd().m}
                    second={currentEnd().s}
                    onHourChange={(v) =>
                        setCurrentEnd({ ...currentEnd(), h: v })
                    }
                    onMinuteChange={(v) =>
                        setCurrentEnd({ ...currentEnd(), m: v })
                    }
                    onSecondChange={(v) =>
                        setCurrentEnd({ ...currentEnd(), s: v })
                    }
                />
            </div>

            {/* 3. 底部操作栏 */}
            <div class="flex justify-around gap-2 mt-8 pb-8">
                <button
                    class="btn btn-soft btn-secondary btn-sm"
                    onClick={handleConfirm}
                >
                    <SaveCheck size={12} />
                    保存
                </button>
                <button
                    class="btn btn-soft btn-accent btn-sm"
                    onClick={handleResetInput}
                >
                    <RotateCcw size={12} />
                    重置
                </button>
                <button
                    class="btn btn-soft btn-warning btn-sm"
                    onClick={handleClose}
                >
                    <CircleX size={12} />
                    关闭
                </button>
            </div>
        </div>
    );
}