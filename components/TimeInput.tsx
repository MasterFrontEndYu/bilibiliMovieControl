import {
    createSignal,
    createEffect,
    untrack,
    onSettled,
    For,
    type Component,
} from "solid-js";

export type TimeValue = { h: number; m: number; s: number };

interface TimeInputProps {
    label: string;
    value: TimeValue;
    onChange: (next: TimeValue) => void;
    delay?: number;
}

type Draft = { h: string; m: string; s: string };

const parse = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
};

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

const FIELDS = [
    { key: "h" as const, max: 24, required: true },
    { key: "m" as const, max: 59, required: true },
    { key: "s" as const, max: 59, required: true },
];

export const TimeInput: Component<TimeInputProps> = (props) => {
    const delay = () => props.delay ?? 300;

    const [draft, setDraft] = createSignal<Draft>({
        h: String(props.value.h),
        m: String(props.value.m),
        s: String(props.value.s),
    });

    // Solid 2.0 双参数签名：compute 阶段只追踪 props.value，
    // effect 阶段拿到计算后的值，决定是否回写 draft。
    // draft 用 untrack 读取，避免自我触发循环。
    createEffect(
        () => props.value,
        (v) => {
            const cur = untrack(draft);
            if (
                parse(cur.h) === v.h &&
                parse(cur.m) === v.m &&
                parse(cur.s) === v.s
            )
                return; // 自己提交引起的回声，保留用户原始输入形态
            setDraft({ h: String(v.h), m: String(v.m), s: String(v.s) });
        },
    );

    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        const cur = draft();
        const next: TimeValue = {
            h: clamp(parse(cur.h), 24),
            m: clamp(parse(cur.m), 59),
            s: clamp(parse(cur.s), 59),
        };

        // 只要解析值被钳制过，就把 draft 规范化回合法值，
        // 保证输入框显示与实际配置一致（修复 25 -> 24 时 draft 不回写的问题）
        if (
            parse(cur.h) !== next.h ||
            parse(cur.m) !== next.m ||
            parse(cur.s) !== next.s
        ) {
            setDraft({ h: String(next.h), m: String(next.m), s: String(next.s) });
        }

        const v = props.value;
        if (next.h === v.h && next.m === v.m && next.s === v.s) return;
        props.onChange(next);
    };

    const schedule = () => {
        if (delay() <= 0) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, delay());
    };

    onSettled(() => {
        return () => {
            if (timer) flush(); // 切换 mode / 关闭 popup 时补交未提交草稿
        };
    });

    const onInput =
        (field: keyof Draft) =>
            (e: InputEvent & { currentTarget: HTMLInputElement }) => {
                setDraft((prev) => ({ ...prev, [field]: e.currentTarget.value }));
                schedule();
            };

    return (
        <div class="flex flex-wrap">
            <div class="flex flex-1 justify-between items-center flex-wrap">
                <span class="text-[13px] text-base-content/60 mr-1 block">
                    {props.label}
                </span>
                <For each={FIELDS}>
                    {(f, i) => (
                        <>
                            {i() > 0 && (
                                <span class="text-base-content/40 mx-1">:</span>
                            )}
                            <input
                                type="number"
                                required={f.required}
                                value={draft()[f.key]}
                                onInput={onInput(f.key)}
                                onBlur={flush}
                                class="input validator input-bordered input-xs w-14 text-center px-2"
                                min="0"
                                max={f.max}
                            />
                        </>
                    )}
                </For>
            </div>
        </div>
    );
};