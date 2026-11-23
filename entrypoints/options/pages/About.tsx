import { getSoftName } from "@/utils/bilibili";
import { BadgeAlert } from "lucide-solid";

export default function AboutPage() {
    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <BadgeAlert size={26} />
                        {getSoftName()}
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        面向 B 站合集的连播助手：片段跳转、云端片段与存档。
                    </p>
                </div>
            </header>

            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-base font-bold text-base-content">
                        技术栈
                    </h2>
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                        WXT + SolidJS + TailwindCSS + DaisyUI + lucide-solid；
                        云端片段查询与上传基于 BilibiliSponsorBlock API。
                    </p>
                </div>
            </div>

            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-base font-bold text-base-content">
                        功能
                    </h2>
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                        片段跳过、到点切换下一 P、云端片段查询与上传，以及自动 / 手动存档。
                    </p>
                </div>
            </div>

            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-base font-bold text-base-content">
                        已知局限
                    </h2>
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                        片段依赖合集剪切点是否整齐；各集删减不一致时，需要手动微调时间。
                    </p>
                </div>
            </div>
        </div>
    );
}
