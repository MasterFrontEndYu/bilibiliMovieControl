import {
    Monitor,
    Cpu,
    FastForward,
    Bookmark,
    History,
    CircleAlert,
    CirclePlay,
    Settings2
} from 'lucide-solid';
import { getSoftName } from '@/utils/bili';


export default function AboutPage() {
    return (
        <div class="max-w-4xl mx-auto py-5">
            {/* 头部标题 */}
            <header class="mb-10">
                <h1 class="text-3xl m-0 mb-3 text-primary flex items-center gap-3">
                    <CirclePlay size={36} />{getSoftName()}
                </h1>
                <p class="text-base-content/70 text-base leading-relaxed">
                    专为 Bilibili 合集视频打造的连播助手。通过像素级帧分析与灵活的存档机制，让你的追剧体验真正实现“无人值守”。
                </p>
            </header>

            {/* 核心提示：适用范围 */}
            <div class="bg-primary/5 border border-primary/20 p-5 rounded-xl mb-8 flex gap-4 items-start">
                <CircleAlert class="text-primary shrink-0 mt-0.5" size={24} />
                <div>
                    <strong class="text-primary text-base">适用范围说明</strong>
                    <p class="mt-1 m-0 text-base-content/70 text-sm">
                        本插件仅针对 B 站用户上传的<strong>“合集”</strong>（即播放器右侧显示选集列表的视频）生效。对电影、番剧正片或普通单视频无效。
                    </p>
                </div>
            </div>

            {/* 功能卡片列表 - 网格布局 */}
            <div class="grid grid-cols-2 gap-5">

                {/* 1. 模式选择 */}
                <section class="bg-base-100 p-6 rounded-2xl flex gap-5 border border-base-300 shadow-sm">
                    <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><Monitor class="text-primary" /></div>
                    <div class="flex-1">
                        <h3 class="m-0 mb-2.5 text-lg text-base-content font-semibold">模式选择</h3>
                        <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                            <strong>智能帧分析：</strong> 采用后台像素级分析，检测视频末尾黑屏即跳。用户设置起始点即可。
                        </p>
                        <p class="m-0 text-sm text-base-content/70 leading-relaxed mt-2.5">
                            <strong>手动模式：</strong> 自定义切集时间点，精准控制每一秒。
                        </p>
                    </div>
                </section>

                {/* 2. 跳过功能 */}
                <section class="bg-base-100 p-6 rounded-2xl flex gap-5 border border-base-300 shadow-sm">
                    <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><FastForward class="text-primary" /></div>
                    <div class="flex-1">
                        <h3 class="m-0 mb-2.5 text-lg text-base-content font-semibold">OP / 先导跳过</h3>
                        <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                            针对片头较长的合集，可设置跳过区间。一旦进入预设范围，插件将瞬间跨越到正片起始位置。<br/>
                            可设置多个跳过区间，满足不同合集的需求。
                        </p>
                    </div>
                </section>

                {/* 3. 自动存档 (最近播放) */}
                <section class="bg-base-100 p-6 rounded-2xl flex gap-5 border border-base-300 shadow-sm">
                    <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><History class="text-primary" /></div>
                    <div class="flex-1">
                        <h3 class="m-0 mb-2.5 text-lg text-base-content font-semibold">自动存档</h3>
                        <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                            系统自动记录最近 20 条合集配置。Popup 界面优先展示最近 2 条，再次访问时自动恢复 OP 跳过与切集参数。
                        </p>
                    </div>
                </section>

                {/* 4. 手动存档 */}
                <section class="bg-base-100 p-6 rounded-2xl flex gap-5 border border-base-300 shadow-sm">
                    <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0"><Bookmark class="text-primary" /></div>
                    <div class="flex-1">
                        <h3 class="m-0 mb-2.5 text-lg text-base-content font-semibold">手动存档</h3>
                        <p class="m-0 text-sm text-base-content/70 leading-relaxed">
                            支持最多 20 条长期手动配置，可一键锁定你最喜爱的合集参数。点击存档即可快速同步时间点。
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}