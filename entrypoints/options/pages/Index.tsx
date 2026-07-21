import { Save, CircleCheck, CircleAlert, Settings, Info } from 'lucide-solid';


export default function Home() {
  

    return (
        <div class="max-w-4xl mx-auto">
            <header class="mb-10">
                <div>
                    <h1 class="text-3xl m-0 mb-3 text-primary flex items-center gap-3">
                        <Settings size={36} /> 全局配置 
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        调整插件的自动化运行参数，优化性能与准确度
                    </p>
                </div>
            </header>

            <div class="bg-base-100 p-8 rounded-2xl shadow-sm border border-base-300">
                暂无设置
            </div>

            <div class="mt-8 p-4 bg-info/10 border border-info/20 rounded-xl flex gap-2.5 items-start">
                <Info size={18} class="text-info shrink-0 mt-0.5" />
                <p class="m-0 text-xs text-base-content/70 leading-relaxed">
                    <b>关于设置：</b> 您可以选择通用的“比例模式”或针对特定视频的“精确模式”。更改将即时同步。
                </p>
            </div>
        </div>
    );
}