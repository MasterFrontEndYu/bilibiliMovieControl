// entrypoints/time-range/App.tsx
import { createSignal, For } from "solid-js";
import { TimeInput } from "@/components/TimeInput";
import type { SkipSegment, TimePoint } from "@/types/types";
import { formatTime, toSeconds } from "@/utils/bilibili";
import { MIN_SEGMENT_SECONDS, secondsToTimePoint } from "@/utils/segments";
import { useConfig } from "@/hooks/useStorageConfig";
import { CircleX, Clock, RotateCcw, SaveCheck, Trash } from "@lucide/solid";
import { useNavigate } from "@solidjs/router";

const ZERO: TimePoint = { h: 0, m: 0, s: 0 };

export default function Open() {
    const { config, update } = useConfig(["segments"]);

    // 编辑区状态
    const [currentId, setCurrentId] = createSignal<string | null>(null);
    const [currentStart, setCurrentStart] = createSignal<TimePoint>({ ...ZERO });
    const [currentEnd, setCurrentEnd] = createSignal<TimePoint>({ ...ZERO });
    const [error, setError] = createSignal("");

    const navigate = useNavigate();

    const skipSegments = () =>
        config.segments.filter((segment) => segment.kind === "skip");

    const timePoint = (segment: SkipSegment, key: "start" | "end") =>
        secondsToTimePoint(segment[key]);

    /** 结束时间必须晚于开始时间且满足最短长度 */
    const canSave = () =>
        toSeconds(currentEnd()) - toSeconds(currentStart()) >=
        MIN_SEGMENT_SECONDS;

    /**
     * 点击列表项 → 把该片段加载到编辑区
     */
    const handleSelect = (segment: SkipSegment) => {
        setError("");
        setCurrentId(segment.id);
        setCurrentStart(timePoint(segment, "start"));
        setCurrentEnd(timePoint(segment, "end"));
    };

    /**
     * 删除某个片段
     */
    const handleRemove = (id: string) => {
        update({
            segments: config.segments.filter((segment) => segment.id !== id),
        });
        if (currentId() === id) {
            handleResetInput();
        }
    };

    /**
     * 保存：新增或更新当前编辑的片段，成功后清空编辑区
     */
    const handleConfirm = () => {
        setError("");

        const start = currentStart();
        const end = currentEnd();

        if (toSeconds(end) - toSeconds(start) < MIN_SEGMENT_SECONDS) {
            setError(`片段长度至少 ${MIN_SEGMENT_SECONDS} 秒`);
            return;
        }

        const list = config.segments.slice();
        const editingId = currentId();

        if (editingId) {
            const index = list.findIndex((segment) => segment.id === editingId);
            if (index >= 0) {
                list[index] = {
                    id: editingId,
                    start: toSeconds(start),
                    end: toSeconds(end),
                    kind: "skip",
                    source: "manual",
                };
                update({ segments: list });
                handleResetInput();
                return;
            }
        }

        list.push({
            id: crypto.randomUUID(),
            start: toSeconds(start),
            end: toSeconds(end),
            kind: "skip",
            source: "manual",
        });
        update({ segments: list });
        handleResetInput();
    };

    /**
     * 重置编辑区（不影响已保存列表）
     */
    const handleResetInput = () => {
        setError("");
        setCurrentId(null);
        setCurrentStart({ ...ZERO });
        setCurrentEnd({ ...ZERO });
    };

    /**
     * 关闭当前页面
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
                    已保存的时段 ({skipSegments().length})
                </div>
                <div class="overflow-y-auto h-48">
                    <For
                        each={skipSegments()}
                        fallback={
                            <div class="m-auto pl-1 text-base-content/30 text-xs">
                                暂无跳过时段
                            </div>
                        }
                    >
                        {(segment) => (
                            <div
                                onClick={() => handleSelect(segment)}
                                class={`flex justify-between items-center px-2.5 py-1 bg-base-100 border ${segment.id == currentId()
                                        ? "border-primary "
                                        : "border-base-300"
                                    } rounded-md cursor-pointer transition-all duration-200 hover:border-primary`}
                            >
                                <span class="text-sm text-base-content/70 font-mono">
                                    {formatTime(timePoint(segment, "start"))} -{" "}
                                    {formatTime(timePoint(segment, "end"))}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(segment.id);
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
                    {currentId() ? "编辑时段" : "设定新时段"}
                </div>

                <TimeInput
                    label="从"
                    value={currentStart()}
                    onChange={(next) => setCurrentStart(next)}
                />

                <TimeInput
                    label="至"
                    value={currentEnd()}
                    onChange={(next) => setCurrentEnd(next)}
                />

                {error() && (
                    <div class="text-xs text-error pl-1">{error()}</div>
                )}
            </div>

            {/* 3. 底部操作栏 */}
            <div class="flex justify-around gap-2 mt-8 pb-8">
                <button
                    class="btn btn-soft btn-secondary btn-sm"
                    onClick={handleConfirm}
                    disabled={!canSave()}
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
