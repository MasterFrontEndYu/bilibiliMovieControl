import { Settings, Info } from 'lucide-solid';

export default function Home() {
  return (
    <div class="max-w-5xl mx-auto px-4 py-6 md:py-10">
      {/* ===== 头部 ===== */}
      <header class="mb-8 md:mb-12">
        <div class="flex items-center gap-3 mb-2">
          <div class="bg-primary/10 p-2.5 rounded-2xl text-primary">
            <Settings size={32} />
          </div>
          <div>
            <h1 class="text-2xl md:text-3xl font-bold m-0 text-base-content">
              功能讲解
            </h1>
            <p class="text-base-content/60 text-sm md:text-base leading-relaxed mt-0.5">
              此插件的基本功能解释 —— 助你高效跳过片头与片尾
            </p>
          </div>
        </div>
      </header>

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
              两种模式可选，适配不同视频类型。
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
                  <span class="text-xs text-base-content/50">适合时间点稳定的剧集，少删减内容导致的切片时间点不一致</span>
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
              <p class="text-sm text-base-content/60 mt-1">详情页保存最近 20 条，方便回溯。</p>
            </div>
            <div class="bg-base-200/60 rounded-xl p-4">
              <div class="flex items-center gap-2 text-sm font-semibold text-base-content">
                <span class="badge badge-outline badge-sm">自动</span>
                显示最新 2 条
              </div>
              <p class="text-sm text-base-content/60 mt-1">详情页保存最近 20 条，随时查找历史记录。</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
