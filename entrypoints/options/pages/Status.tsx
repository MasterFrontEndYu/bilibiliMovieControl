import { BellDot } from "@lucide/solid";
import { createSignal, onSettled } from "solid-js";
import { browser } from "wxt/browser";

export default function StatusPage() {
    const [status, setStatus] = createSignal<boolean>(true);

    // 初始化加载
    onSettled(() => {
        let alive = true;
        (async () => {
            try {
                const res = await browser.storage.local.get({ isAutoHandle: true });
                if (alive) setStatus(res.isAutoHandle as boolean);
            } catch (err) {
                console.error("[Status] 初始化读取失败:", (err as Error)?.cause ?? err);
            }
        })();
        return () => {
            alive = false;
        };
    });

    const updateStatus = async () => {
        const newStatus = !status();
        setStatus(newStatus);
        try {
            await browser.storage.local.set({ isAutoHandle: newStatus });
        } catch (err) {
            console.error("[Status] 保存失败:", (err as Error)?.cause ?? err);
            setStatus(!newStatus); // 回滚 UI
        }
    };

    return (
        <div class="max-w-4xl mx-auto">
            {/* ===== 头部 ===== */}
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <BellDot size={26} />
                        状态设置
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
                        <span
                            class={`${status() ? "text-success" : "text-error"
                                }`}
                        >
                            合集处理状态：{status() ? "启动中" : "关闭"}
                        </span>
                    </h2>
                    <div class="flex items-center">
                        <div
                            class={`aura  ${status()
                                ? "aura-rainbow duration-1000"
                                : "text-orange-600"
                                }`}
                        >
                            <button
                                onClick={updateStatus}
                                class={`btn btn-soft ${status() ? "btn-success" : "btn-error"
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