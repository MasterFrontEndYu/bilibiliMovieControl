import type { ParentProps } from "solid-js";


export default function App(props: ParentProps) {
    return (
        <div class="card bg-base-100 shadow-xl rounded-box p-4 w-72 gap-3">
            {props.children}
        </div>
    );
}