import { getSoftName } from '@/utils/bilibili';
import { BadgeAlert } from '@lucide/solid';


export default function AboutPage() {
    return (
        <div class="max-w-4xl mx-auto">
            {/* 头部标题 */}
            <header class="max-w-4xl mb-10">
                <h1 class="text-3xl   mb-3 text-primary flex items-center gap-3">
                    <BadgeAlert size={26} />
                     {getSoftName()}
                </h1>
                <p class="text-base-content/70 text-base leading-relaxed">
                    专为 Bilibili 合集视频打造的连播助手。通过切集点自动跳转与灵活的存档机制，让你的追剧体验真正实现“无人值守”。
                </p>
            </header>

            {/* 功能卡片列表 - 网格布局 */}
            <div class="grid">
                <section class="bg-base-100 p-6 my-2 rounded-2xl border border-base-300 shadow-sm">
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        <strong>框架：</strong> WTX + SolidJS rc 2.X + TailwindCSS + DaisyUI + @lucide/solid
                    </p>
                </section>
                <section class="bg-base-100 p-6 my-2 rounded-2xl border border-base-300 shadow-sm">
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        <strong>作用：</strong> 源自用B站用户上传合集视频跳转片头片尾的需求，提供了自动跳转、存档等功能。
                    </p>
                </section>
                <section class="bg-base-100 p-6 my-2 rounded-2xl border border-base-300 shadow-sm">
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        <strong>缺点：</strong> 切集依赖合集剪切点是否整齐，各集删减不一致时可能出现末尾提前跳转；留提前量太多又会影响观看体验。
                    </p>
                </section>
            </div>
        </div>
    );
}