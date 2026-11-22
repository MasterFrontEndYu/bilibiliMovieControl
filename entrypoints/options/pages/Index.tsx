import {
    MAX_HISTORY_LENGTH,
    PINNED_HISTORY_LENGTH,
    LATEST_HISTORY_LENGTH,
} from "@/utils/bilibili";
import { Cloud, Film, HouseHeart, Info, Save } from "@lucide/solid";

export default function Home() {
    return (
        <div class="max-w-4xl mx-auto">
            {/* ===== 头部 ===== */}
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <HouseHeart size={26} />
                        功能讲解
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        片段跳转、云端片段与存档
                    </p>
                </div>
            </header>

            <div class="bg-primary/5 border border-primary/20 p-5 rounded-xl mb-8 flex gap-4 items-start">
                <Info size={16} class="text-primary shrink-0 mt-1" />
                <div>
                    <strong class="text-primary text-base">适用范围</strong>
                    <p class="mt-1 m-0 text-base-content/70 text-sm">
                        仅对 B 站用户上传的<strong>“合集”</strong>
                        （播放器右侧有选集列表）生效；电影、番剧正片、普通单视频不处理。
                    </p>
                </div>
            </div>

            {/* ===== 片段跳转 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
                        <span class="text-primary">
                            <Film size={18} />
                        </span>
                        片段跳转
                    </h2>

                    <p class="text-sm text-base-content/80 leading-relaxed">
                        在播放页点「设置」，用起止时间管理片段：
                    </p>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                OP 跳过
                            </div>
                            <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                播放进入区间时直接跳到终点，适合片头、插播广告。
                            </p>
                        </div>
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                下一 P
                            </div>
                            <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                到达片段起点时点击「下一 P」；全局只保留一个，并排在列表最后。
                            </p>
                        </div>
                    </div>

                    <ul class="text-sm text-base-content/60 leading-relaxed m-0 pl-5 list-disc space-y-1">
                        <li>「开头 / 结尾」各自有编辑、保存两个状态，可分别修改</li>
                        <li>结束时间早于开始时间时，自动取「开始 + 20 秒」</li>
                        <li>支持预览、定位开头 / 定位结尾、删除；删完还有片段就不关窗口</li>
                        <li>下一 P 早于 OP 跳过结束时，页面状态条会变橙色提示</li>
                    </ul>
                </div>
            </div>

            {/* ===== 页面悬浮窗 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
                        <span class="text-secondary">🪟</span>
                        页面悬浮窗
                    </h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                查看
                            </div>
                            <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                只读展示手动片段和云端片段，带来源标识。
                            </p>
                        </div>
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                设置
                            </div>
                            <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                编辑片段、新建片段、上传手动片段。
                            </p>
                        </div>
                    </div>
                    <p class="text-sm text-base-content/60 leading-relaxed m-0">
                        窗口可拖拽，位置限制在播放器范围内；关闭后下次点按钮重新打开。
                    </p>
                </div>
            </div>

            {/* ===== 云端片段与上传 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
                        <span class="text-accent">
                            <Cloud size={18} />
                        </span>
                        云端片段与上传
                    </h2>
                    <p class="text-sm text-base-content/80 leading-relaxed m-0">
                        云端片段来自
                        <a
                            class="link link-primary"
                            href="https://bsbsb.top"
                            target="_blank"
                        >
                            BilibiliSponsorBlock
                        </a>
                        。查询结果显示在「查看」里（标识 BiliSB），手动片段可上传到同一接口。
                        上传需要私人 ID，首次自动生成并保存在本地。
                    </p>
                    <p class="text-sm text-base-content/60 leading-relaxed m-0">
                        可在「云端片段」设置页开关是否参与跳转（默认开启）：intro /
                        sponsor 作为跳过，outro 作为下一 P；与手动片段重叠时手动优先。
                    </p>

                    <div class="bg-base-200/60 rounded-xl p-4 text-sm text-base-content/70 leading-relaxed">
                        <div class="font-semibold text-base-content mb-2">
                            API 环境
                        </div>
                        <div class="space-y-1 font-mono text-xs break-all">
                            <div>正式：https://bsbsb.top/api/skipSegments</div>
                            <div>测试：https://bsbsb.top/test/api/skipSegments</div>
                        </div>
                        <p class="m-0 mt-2 text-xs text-base-content/50">
                            默认使用正式环境；需要查询测试环境时，启动前设置
                            <code class="mx-1">VITE_SB_API=test</code>。
                            测试环境只支持查询，不支持上传。
                        </p>
                    </div>
                </div>
            </div>

            {/* ===== 存档 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-base font-bold text-base-content flex items-center gap-2">
                        <span class="text-accent">
                            <Save size={18} />
                        </span>
                        保存记录
                    </h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-base-content">
                                <span class="badge badge-outline badge-sm">
                                    手动存档
                                </span>
                                显示最新 {PINNED_HISTORY_LENGTH} 条
                            </div>
                            <p class="text-sm text-base-content/60 mt-1">
                                Options 页面保留最近 {MAX_HISTORY_LENGTH} 条。
                            </p>
                        </div>
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="flex items-center gap-2 text-sm font-semibold text-base-content">
                                <span class="badge badge-outline badge-sm">
                                    自动存档
                                </span>
                                显示最新 {LATEST_HISTORY_LENGTH} 条
                            </div>
                            <p class="text-sm text-base-content/60 mt-1">
                                Options 页面保留最近 {MAX_HISTORY_LENGTH} 条。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
