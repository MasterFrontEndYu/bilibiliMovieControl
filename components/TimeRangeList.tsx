import { createSignal, For } from "solid-js";
import { TimeInput } from "@/components/TimeInput";
import { Trash2, Clock, Save, TimerReset, CopyX } from "lucide-solid";
import type { TimeRange, TimeRangeManagerProps } from "@/types/types";
import { formatTime } from "@/utils/bilibili"


export const TimeRangeManager = (props: TimeRangeManagerProps) => {
    // 当前正在编辑的时间状态（仅用于新增时段，不直接修改外部列表）
    const defaultTime = () => ({ h: 0, m: 0, s: 0 });
    const [currentId, setCurrentId] = createSignal<string | null>(null);
    const [currentStart, setCurrentStart] = createSignal(defaultTime());
    const [currentEnd, setCurrentEnd] = createSignal(defaultTime());


    // 添加到列表（调用 onUpdate）
    const handleConfirm = () => {
        const newRange: TimeRange = {
            id: currentId() || crypto.randomUUID(),
            start: { ...currentStart() },
            end: { ...currentEnd() },
        };
        let updatedRanges;
        if (currentId()) {
            updatedRanges = props.ranges.map(r => r.id === currentId() ? newRange : r);
        } else {
            updatedRanges = [...props.ranges, newRange];
        }
        props.onUpdate({ opRanges : updatedRanges });
        handleResetInput();
        setCurrentId(null);
    };

    // 删除时间段
    const handleRemove = (id: string) => {
        props.onUpdate({ opRanges: props.ranges.filter((r) => r.id !== id) });
    };

    // 点击列表项：回填数据到编辑框（方便快速修改）
    const handleSelect = (range: TimeRange) => {
        setCurrentId(range.id);
        setCurrentStart({ ...range.start });
        setCurrentEnd({ ...range.end });
    };

    // 重置编辑框
    const handleResetInput = () => {
        setCurrentStart(defaultTime());
        setCurrentEnd(defaultTime());
        setCurrentId(null);
    };

    return (
        <div
            class="card bg-base-100 rounded-box flex flex-col w-full h-full"
        >
            {/* 1. 顶部列表 */}
            <div class="text-center text-lg font-bold text-primary leading-9">
                设置OP跳转时间段
            </div>
            <div class="bg-base-200 p-2 mt-5 flex flex-col gap-1 rounded-box">
                <div class="text-xs font-bold text-base-content/60 mb-1 pl-1">
                    已保存的时段 ({props.ranges.length})
                </div>
                <div class="overflow-y-auto h-48">
                    <For
                        each={props.ranges}
                        fallback={
                            <div class="m-auto text-base-content/30 text-xs">
                                暂无跳过时段
                            </div>
                        }
                    >
                        {(range) => (
                            <div
                                onClick={() => handleSelect(range)}
                                class={`flex justify-between items-center px-2.5 py-1 bg-base-100 border ${range.id == currentId() ? "border-primary " :"border-base-300"} rounded-md cursor-pointer transition-all duration-200 hover:border-primary`}
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
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* 2. 中间编辑区 */}
            <div class="p-3 mt-4 bg-primary/5 flex flex-col gap-2.5 rounded-box">
                <div class="text-xs font-bold text-primary flex items-center gap-1">
                    <Clock size={14} /> 设定新时段
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
                <button class="btn btn-soft btn-secondary btn-sm" onClick={handleConfirm}><Save size={14} /> 保存</button>
                <button class="btn btn-soft btn-accent btn-sm" onClick={handleResetInput}><TimerReset size={14} /> 重置</button>
                <button class="btn btn-soft btn-warning btn-sm" onClick={() => props.onClose()}><CopyX size={14} /> 关闭</button>
            </div>
        </div>
    );
};
