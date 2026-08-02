import { createSignal, onMount } from "solid-js";
import { Info, LayoutDashboard } from "lucide-solid";
import { browser } from "wxt/browser";

export default function Home() {
    const [status, setStatus] = createSignal<boolean>(true);

    onMount(async () => {
        const res = await browser.storage.local.get({ isAutoHandle: true });
        setStatus(res.isAutoHandle as boolean);
    });

    const updateStatus = async () => {
        setStatus(!status());
        await browser.storage.local.set({ isAutoHandle: status() });
    };

    return (
        <div class="max-w-4xl mx-auto">
            {/* ===== 头部 ===== */}
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <Info size={36} /> 状态设置
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        设置此插件是自动运行，还是关闭。
                    </p>
                </div>
            </header>

            {/* ===== 其他功能：保存记录 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-base font-bold text-base-content flex items-center gap-2">
                        <LayoutDashboard />
                        <span
                            class={`${
                                status() ? "text-success" : "text-error"
                            }`}
                        >
                            合集处理状态：{status() ? "启动中" : "关闭"}
                        </span>
                    </h2>
                    <div class="flex items-center">
                        <div
                            class={`aura  ${
                                status()
                                    ? "aura-rainbow duration-1000"
                                    : "text-orange-600"
                            }`}
                        >
                            <button
                                onClick={updateStatus}
                                class={`btn btn-soft ${
                                    status() ? "btn-success" : "btn-error"
                                }`}
                            >
                                {status() ? "启动中" : "关闭"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
