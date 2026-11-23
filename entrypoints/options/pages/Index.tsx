import { onCleanup, onMount } from "solid-js";
import {
    MAX_HISTORY_LENGTH,
    PINNED_HISTORY_LENGTH,
    LATEST_HISTORY_LENGTH,
} from "@/utils/bilibili";
import { Cloud, Film, HouseHeart, Info, Save } from "lucide-solid";

export default function Home() {
    onMount(() => {
        const scrollToSettings = () => {
            const query =
                location.search.replace(/^\?/, "") ||
                (location.hash.split("?")[1] ?? "");
            const params = new URLSearchParams(query);

            if (params.get("section") !== "settings") return;

            requestAnimationFrame(() => {
                document
                    .getElementById("settings-help")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        };

        scrollToSettings();
        window.addEventListener("hashchange", scrollToSettings);
        onCleanup(() =>
            window.removeEventListener("hashchange", scrollToSettings),
        );
    });

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
                        片段跳转、进度条标记、云端片段与存档
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
                        在播放页点「片段设置」，用起止时间管理片段：
                    </p>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                片段跳过
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
                        <li>
                            起止时间可以手动输入
                            <code class="mx-1">时:分:秒</code>
                            ，也可以点「导入开头 / 导入结尾」把当前播放进度直接写进对应输入框
                        </li>
                        <li>
                            编辑器有「编辑 / 保存」两种状态：先点「编辑」解锁输入框和操作，改完再点「保存」；未编辑时导入、预览、定位都不可用
                        </li>
                        <li>
                            结束时间不晚于开始时间时，保存会自动取「开始 + 20 秒」
                        </li>
                        <li>
                            类型可在「片段跳过 / 下一P」间切换；新建草稿切到「下一P」时，结束会自动取视频结尾
                        </li>
                        <li>
                            选中片段或新建草稿后，编辑器会载入对应时间；每个片段行尾都有独立的「删除」按钮
                        </li>
                        <li>
                            支持预览（跳到片段前 3 秒并执行一次）、定位头 / 定位尾（直接跳到编辑框里的时间）
                        </li>
                    </ul>
                </div>
            </div>

            {/* ===== 进度条标记 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
                        <span class="text-primary">▬</span>
                        进度条标记
                    </h2>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-base-200/60 rounded-xl p-4 flex items-center gap-3">
                            <span class="inline-block w-8 h-2 rounded-sm bg-purple-500"></span>
                            <div>
                                <div class="font-semibold text-sm text-base-content">
                                    紫色 = 片段跳过
                                </div>
                                <p class="text-sm text-base-content/60 m-0">
                                    区间内播放会直接跳走。
                                </p>
                            </div>
                        </div>
                        <div class="bg-base-200/60 rounded-xl p-4 flex items-center gap-3">
                            <span class="inline-block w-8 h-2 rounded-sm bg-red-500"></span>
                            <div>
                                <div class="font-semibold text-sm text-base-content">
                                    红色 = 下一 P
                                </div>
                                <p class="text-sm text-base-content/60 m-0">
                                    到达起点后切换到下一 P。
                                </p>
                            </div>
                        </div>
                    </div>

                    <ul class="text-sm text-base-content/60 leading-relaxed m-0 pl-5 list-disc space-y-1">
                        <li>
                            手动片段和云端片段都会画在播放器进度条上；与手动片段重叠的云端片段不重复画，和实际播放判断一致
                        </li>
                        <li>
                            「下一P」的红色从起点一直画到该片段的结束位置；结束小于等于起点时表示“走到视频结尾”
                        </li>
                        <li>片段增删改、云端刷新后标记会实时更新，不用刷新页面</li>
                        <li>仅在合集播放页显示；离开合集、切换视频时自动清除</li>
                        <li>
                            控制条自动隐藏后，色块仍保留在原进度条的位置，形成一条常驻细色带，不会盖住画面其他部分
                        </li>
                    </ul>

                    <p class="text-sm text-base-content/60 leading-relaxed m-0">
                        这两种显示在设置页「界面显示」里分别有开关：「进度条标记」（控制条显示时的色块）和「常驻色带」（控制条隐藏后的细色带）。
                    </p>
                </div>
            </div>

            {/* ===== 页面悬浮窗 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
                        <span class="text-secondary">🪟</span>
                        页面悬浮窗
                    </h2>
                    <div class="flex flex-col gap-3">
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                查看
                            </div>
                            <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                只读展示手动片段和云端片段，带来源标识，可手动刷新云端片段。
                            </p>
                        </div>
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-sm text-base-content mb-1">
                                设置
                            </div>
                            <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                编辑片段、新建片段、删除片段，并把手动片段上传到
                                bsbsb.top。
                            </p>
                        </div>
                    </div>
                    <p class="text-sm text-base-content/60 leading-relaxed m-0">
                        窗口可拖拽，位置限制在播放器范围内；关闭后下次点按钮重新打开。
                    </p>
                </div>
            </div>

            {/* ===== 设置流程 ===== */}
            <div
                id="settings-help"
                class="card bg-base-100 shadow-sm border border-base-300 mb-8 scroll-mt-6"
            >
                <div class="card-body gap-4 p-6">
                    <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
                        <span class="text-primary">🧭</span>
                        设置流程
                    </h2>

                    <div class="flex flex-col gap-3 text-sm text-base-content/70 leading-relaxed">
                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                1. 打开合集播放页
                            </div>
                            <p class="m-0">
                                播放页标题上方会出现一行插件 UI：左侧是状态条
                                <code class="mx-1">⏭ 片段跳过 N 段</code>
                                <code class="mx-1">🔚 下一P时间</code>
                                <code class="mx-1">☁ 云端 N 个</code>
                                和「查看云端数据→」；右侧是「片段查看 / 片段设置」两个按钮。
                                不想看到其中某些项，可以去设置页的「界面显示」逐个关闭。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                2. 打开「片段设置」
                            </div>
                            <p class="m-0">
                                点右侧「片段设置」，浮动窗口会停在「设置」页。
                                编辑器会自动选一个目标：正在编辑的草稿 → 已选中的片段 →
                                当前播放进度所在的片段 → 列表里的第一条；一个片段都没有时，直接生成一条新草稿（起始 =
                                当前进度，结束 = 起始 + 20 秒）。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                3. 新建片段
                            </div>
                            <p class="m-0">
                                点列表下方的「＋ 新建片段（当前进度）」：起始取当前播放进度，结束取起始
                                + 20 秒（不超过视频时长），编辑器会载入这组草稿时间，此时「编辑」按钮亮起、
                                其它操作和输入框保持锁定。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                4. 点「编辑」解锁
                            </div>
                            <p class="m-0">
                                点蓝色的「编辑」按钮后，输入框、类型下拉、导入开头 / 导入结尾、预览、定位头、定位尾才可用，按钮本身变成粉色的「保存」。
                                两个时间的填法：
                                <br />
                                ① 手动输入，支持 <code>90</code> / <code>01:30</code> /
                                <code>00:01:30</code> 三种格式；
                                <br />
                                ② 边看边点「导入开头」/「导入结尾」，把当前播放进度分别写进起始 / 结束输入框。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                5. 选择类型
                            </div>
                            <p class="m-0">
                                下拉框可以在「片段跳过」和「下一P」之间切换：跳过用于片头 / 广告等区间；
                                下一P 到点后切换下一集，全局只保留一个，并在列表里排最后。
                                新建草稿切到「下一P」时，结束位置会自动填成视频结尾。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                6. 保存
                            </div>
                            <p class="m-0">
                                点粉色的「保存」写入当前片段并回到只读状态。
                                如果结束时间不晚于开始时间，会自动改成「开始 + 20 秒」（不超过视频时长）；
                                保存后编辑器仍停在刚保存的片段上，可以再点「编辑」继续修改。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                7. 预览 / 定位头 / 定位尾
                            </div>
                            <p class="m-0">
                                三个按钮都只在编辑状态可用：
                                「预览」跳到片段前 3 秒开始播放，并在到达起点时执行一次跳过 / 切集；
                                「定位头」「定位尾」直接跳到编辑框里的起始 / 结束时间，方便对点。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                8. 删除片段
                            </div>
                            <p class="m-0">
                                每条手动片段行尾都有「删除」按钮，点它只会删这一条，不会触发选中。
                                删掉最后一条后浮动窗口会自动关闭；云端片段不能删除，只能刷新。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                9. 上传
                            </div>
                            <p class="m-0">
                                私人 ID 首次使用会自动生成并保存在本地，也可以替换成你已有的 ID。
                                点「上传到 bsbsb.top」把当前手动片段提交到云端；
                                云端片段开关关闭时，私人 ID 和上传按钮会隐藏。
                            </p>
                        </div>

                        <div class="bg-base-200/60 rounded-xl p-4">
                            <div class="font-semibold text-base-content mb-1">
                                10. 云端数据与界面显示
                            </div>
                            <p class="m-0">
                                状态条旁的「查看云端数据→」会带上当前 BV 和分 P，打开按 cid 分组的云端片段列表。
                                设置页侧边栏的「界面显示」可以分别开关状态条三项、两个按钮和云端链接，
                                以及进度条的「进度条标记」和「常驻色带」两项。
                            </p>
                        </div>
                    </div>
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
                        。查询结果显示在「查看」里（标识 BiliSB），也会画在进度条上（紫色跳过 / 红色下一P），
                        手动片段可上传到同一接口。上传需要私人 ID，首次自动生成并保存在本地。
                    </p>
                    <p class="text-sm text-base-content/60 leading-relaxed m-0">
                        可在「云端片段」设置页开关是否参与跳转（默认开启）：intro /
                        sponsor 作为跳过，outro 作为下一 P；与手动片段重叠时手动优先，
                        云端多条下一 P 时只取起点最大的一条。
                    </p>
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
