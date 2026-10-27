import type { Component } from "solid-js";

interface TimeInputProps {
    label: string;
    hour: number;
    minute: number;
    second: number;
    onHourChange: (val: number) => void;
    onMinuteChange: (val: number) => void;
    onSecondChange: (val: number) => void;
}

export const TimeInput: Component<TimeInputProps> = (props) => {
    return (
        <div class="flex flex-wrap">
            <div class="flex flex-1 justify-between items-center flex-wrap">
                <span class="text-[14px] text-base-content/60 mr-2 block">{props.label}</span>
                <input
                    type="number"
                    value={props.hour}
                    onInput={e => props.onHourChange(+e.currentTarget.value)}
                    class="input validator input-bordered input-xs w-16 text-center px-2"
                    min="0"
                    max="999999"
                />
                <span class="text-base-content/40 mx-1">:</span>
                <input
                    type="number"
                    required
                    value={props.minute}
                    onInput={e => props.onMinuteChange(Math.min(+e.currentTarget.value, 59))}
                    class="input validator input-bordered input-xs w-14 text-center px-2"
                    min="0"
                    max="59"
                />
                <span class="text-base-content/40 mx-1">:</span>
                <input
                    type="number"
                    required
                    value={props.second}
                    onInput={e => props.onSecondChange(Math.min(+e.currentTarget.value, 59))}
                    class="input validator input-bordered input-xs w-14 text-center px-2"
                    min="0"
                    max="59"
                />
            </div>
        </div>
    );
};