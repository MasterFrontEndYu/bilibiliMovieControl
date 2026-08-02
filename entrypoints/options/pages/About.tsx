import {
    CirclePlay
} from 'lucide-solid';
import { getSoftName } from '@/utils/bilibili';


export default function AboutPage() {
    return (
        <div class="max-w-4xl mx-auto">
            {/* 头部标题 */}
            <header class="max-w-4xl mb-10">
                <h1 class="text-3xl   mb-3 text-primary flex items-center gap-3">
                    <CirclePlay size={36} /> {getSoftName()}
                </h1>
                <p class="text-base-content/70 text-base leading-relaxed">
                    专为 Bilibili 合集视频打造的连播助手。通过像素级帧分析与灵活的存档机制，让你的追剧体验真正实现“无人值守”。
                </p>
            </header>

            {/* 功能卡片列表 - 网格布局 */}
            <div class="grid">
                <section class="bg-base-100 p-6 my-2 rounded-2xl border border-base-300 shadow-sm">
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        <strong>框架：</strong> WTX + SolidJS + TailwindCSS + DaisyUI
                    </p>
                </section>
                <section class="bg-base-100 p-6 my-2 rounded-2xl border border-base-300 shadow-sm">
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        <strong>作用：</strong> 源自用B站用户上传合集视频跳转片头片尾的需求，提供了自动跳转、存档等功能。
                    </p>
                </section>
                <section class="bg-base-100 p-6 my-2 rounded-2xl border border-base-300 shadow-sm">
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        <strong>缺点：</strong> 帧分析功能比较薄弱，仅可在黑底白字的演员表可用，还容易黑屏误触。
                    </p>
                    <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                        手动分析比较吃合集剪切点是否整齐，如果剪切点不整齐，可能会出现末尾提前跳转的可能，留提前量太多影响观看体验。
                    </p>
                </section>
            </div>
        </div>
    );
}