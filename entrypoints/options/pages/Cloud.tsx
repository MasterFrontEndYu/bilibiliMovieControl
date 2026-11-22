import { Cloud } from "@lucide/solid";
import { useConfig } from "@/hooks/useStorageConfig";

export default function CloudPage() {
    const { config, update } = useConfig(["useCloudSegments"]);

    const enabled = () => config.useCloudSegments;

    const toggle = () => {
        void update({ useCloudSegments: !enabled() });
    };

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <Cloud size={26} />
                        云端片段
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        是否把 BilibiliSponsorBlock 的片段并入播放判断。
                    </p>
                </div>
            </header>

            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-4 p-6">
                    <h2 class="card-title text-base font-bold text-base-content">
                        使用云端片段：{enabled() ? "已开启" : "已关闭"}
                    </h2>
                    <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                        开启后，intro / sponsor 作为 OP 跳过，outro 作为下一 P；
                        与手动片段重叠时手动优先。
                    </p>
                    <div class="flex items-center">
                        <div class="card-actions justify-end p-6">
                            <div
                                class={`aura ${
                                    enabled()
                                        ? "aura-rainbow duration-1000"
                                        : "text-orange-600"
                                }`}
                            >
                                <button
                                    class={`btn btn-soft ${
                                        enabled() ? "btn-success" : "btn-error"
                                    }`}
                                    onClick={toggle}
                                >
                                    {enabled() ? "已开启" : "已关闭"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
