import { ParentProps } from 'solid-js';
import { A } from '@solidjs/router';
import { Settings, History, Info, HandGrab } from 'lucide-solid';
import { OptionsFooter } from '@/components/OptionsFooter';

import { getSoftName } from '@/utils/bili';

export default function Layout(props: ParentProps) {
    return (
        <div class="flex h-screen overflow-hidden bg-base-200">
            {/* 侧边栏 */}
            <nav class="w-60 h-full bg-base-100 border-r border-base-300 p-5 flex flex-col gap-2.5 shrink-0">
                <div>
                    <h2 class="text-primary text-lg mb-5 font-bold">{getSoftName()}设置</h2>

                    <A href="/" end activeClass="active-link" class="flex items-center gap-2.5 px-3 py-3 no-underline text-base-content/70 rounded-lg transition-all duration-200 hover:bg-primary/5">
                        <Settings size={18} /> 全局配置
                    </A>
                    <A href="/history" activeClass="active-link" class="flex items-center gap-2.5 px-3 py-3 no-underline text-base-content/70 rounded-lg transition-all duration-200 hover:bg-primary/5">
                        <History size={18} /> 自动存档
                    </A>
                    <A href="/manual" activeClass="active-link" class="flex items-center gap-2.5 px-3 py-3 no-underline text-base-content/70 rounded-lg transition-all duration-200 hover:bg-primary/5">
                        <HandGrab size={18} /> 手动存档
                    </A>
                    <A href="/about" activeClass="active-link" class="flex items-center gap-2.5 px-3 py-3 no-underline text-base-content/70 rounded-lg transition-all duration-200 hover:bg-primary/5">
                        <Info size={18} /> 插件说明
                    </A>
                </div>
            </nav>

            {/* 页面内容主体：允许独立滚动 */}
            <main class="flex-1 p-10 overflow-y-auto h-full">
                {props.children}
                <OptionsFooter />
            </main>

            <style>{`
                .active-link { background: #ffeef3 !important; color: #fb7299 !important; font-weight: bold; }
            `}</style>
        </div>
    );
}