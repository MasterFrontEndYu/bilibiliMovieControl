import { createSignal, onMount } from "solid-js";
import { Info, CircleAlert, LayoutDashboard } from "lucide-solid";
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
                        设置此插件是自动判断运行，还是根据用户的添加的存档。
                    </p>
                </div>
            </header>

            <div class="bg-primary/5 border border-primary/20 p-5 rounded-xl mb-8 flex gap-4 items-start">
                <CircleAlert class="text-primary shrink-0 mt-0.5" size={24} />
                <div>
                    <strong class="text-primary text-base">适用范围说明</strong>

                    <p class="mt-1 m-0 text-base-content/70 text-sm pb-1">
                        <br />
                        1.
                        自动处理合集：插件会自动判断合集，如果是，则自动处理合集中的视频。
                        <br />
                        <br />
                        2.
                        手动处理合集：插件不会自动处理合集，只会处理用户存档的合集中的视频。
                        <br />
                        <br />
                        3. 插件将默认自动处理所有符合条件的视频。
                    </p>
                </div>
            </div>

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
                            合集处理状态：{status() ? "自动处理" : "手动处理"}
                        </span>
                    </h2>
                    <div class="w-full">
                        点击此按钮，确定插件是自动处理合集，还是手动处理合集。
                    </div>
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
                                {status() ? "自动处理" : "手动处理"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
