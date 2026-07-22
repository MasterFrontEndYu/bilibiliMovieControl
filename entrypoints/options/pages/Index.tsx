import { Settings, Info, CircleAlert } from 'lucide-solid';

import { MAX_HISTORY_LENGTH } from "@/utils/bili";

export default function Home() {
  return (
    <div class="max-w-4xl mx-auto">
      {/* ===== 头部 ===== */}
      <header class="flex justify-between items-center mb-10">
        <div>
          <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
            <Info size={36} /> 功能讲解
          </h1>
          <p class="text-base-content/70 text-base leading-relaxed">
            此插件的基本功能解释 —— 助你高效跳过片头与片尾
          </p>
        </div>
      </header>

      <div class="bg-primary/5 border border-primary/20 p-5 rounded-xl mb-8 flex gap-4 items-start">
        <CircleAlert class="text-primary shrink-0 mt-0.5" size={24} />
        <div>
          <strong class="text-primary text-base">适用范围说明</strong>
          <p class="mt-1 m-0 text-base-content/70 text-sm">
            本插件仅针对 B 站用户上传的<strong>“合集”</strong>（即播放器右侧显示选集列表的视频）生效。对电影、番剧正片或普通单视频无效。
          </p>
        </div>
      </div>


      {/* ===== 两大核心功能：网格卡片 ===== */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* OP 跳转 */}
        <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
          <div class="card-body gap-3 p-6">
            <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
              <span class="text-primary">⏱️</span> OP 跳转
            </h2>
            <p class="text-sm text-base-content/80 leading-relaxed">
              合集内的单个视频跳转到指定点，可设置多个起止点，灵活跳过片头或广告。
            </p>
            <div class="bg-base-200/60 rounded-xl p-4 mt-1">
              <p class="text-sm text-base-content/70 leading-relaxed m-0">
                <span class="font-semibold text-base-content">示例：</span>
                从视频开头跳转到 5:00，设置起点 0:00:00，终点 0:05:00；
                <br />
                若第 6 分钟有 30 秒广告，再设起点 0:06:00，终点 0:06:30，即可连续跳过。
              </p>
            </div>
          </div>
        </div>

        {/* 跳转下一 P */}
        <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
          <div class="card-body gap-3 p-6">
            <h2 class="card-title text-lg font-bold text-base-content flex items-center gap-2">
              <span class="text-secondary">▶️</span> 跳转下一 P
            </h2>
            <p class="text-sm text-base-content/80 leading-relaxed">
              两种模式可选，适配不同跳转方式。
            </p>
            <div class="space-y-3 mt-1">
              <div class="flex items-start bg-base-200/50 rounded-xl p-3">
                <span class="badge badge-primary badge-md w-18 mt-0.5 mr-2">帧分析</span>
                <p class=" flex-1 text-sm text-base-content/70 leading-relaxed m-0">
                  在剧集结束前设定时间点，检测白底黑字（如演职员表）自动跳转。
                  <br />
                  <span class="text-xs text-base-content/50">适合美剧、电影片段合集（注意：黑屏可能误触）</span>
                </p>
              </div>
              <div class="flex items-start bg-base-200/50 rounded-xl p-3">
                <span class="badge badge-secondary badge-md w-18 mt-0.5 mr-2">手动</span>
                <p class="felx-1 text-sm text-base-content/70 leading-relaxed m-0">
                  视频播放到设定时间点直接跳转。
                  <br />
                  <span class="text-xs text-base-content/50">适合时间点稳定的剧集，多删减内容的切片时间点会不一致</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 其他功能：保存记录 ===== */}
      <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
        <div class="card-body gap-3 p-6">
          <h2 class="card-title text-base font-bold text-base-content flex items-center gap-2">
            <span class="text-accent">💾</span> 保存记录
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="bg-base-200/60 rounded-xl p-4">
              <div class="flex items-center gap-2 text-sm font-semibold text-base-content">
                <span class="badge badge-outline badge-sm">手动</span>
                显示最新 3 条
              </div>
              <p class="text-sm text-base-content/60 mt-1">详情页保存最近 { MAX_HISTORY_LENGTH } 条，方便回溯。</p>
            </div>
            <div class="bg-base-200/60 rounded-xl p-4">
              <div class="flex items-center gap-2 text-sm font-semibold text-base-content">
                <span class="badge badge-outline badge-sm">自动</span>
                显示最新 2 条
              </div>
              <p class="text-sm text-base-content/60 mt-1">详情页保存最近 { MAX_HISTORY_LENGTH } 条，随时查找历史记录。</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
