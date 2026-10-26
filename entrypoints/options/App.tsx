import { onSettled, type ParentProps } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { OptionsFooter } from '@/components/OptionsFooter';


import { getSoftName } from '@/utils/bilibili';
import { BellDot, HouseHeart, Keyboard, RobotVacuum, ScanEye } from '@lucide/solid';

// 注意：这里只能存图标组件本身，不能在模块顶层直接写 <HouseHeart size={12} />。
// 模块顶层没有 reactive owner，生产构建里 createComponent 只是 untrack 执行，
// 图标内部的 useContext 会抛 NoOwnerError（dev 下 createComponent 会包一层 root，所以只有打包后才报错）。
const NAV_LINKS = [
  {
    to: "/", label: "功能讲解", icon: HouseHeart
  },
  {
    to: "/status", label: "状态设置", icon: BellDot
  },
  {
    to: "/shortcut", label: "快捷键设置", icon: Keyboard
  },
  {
    to: "/history", label: "自动存档", icon: RobotVacuum
  },
  {
    to: "/manual", label: "手动存档", icon: ScanEye
  }
];

export default function Layout(props: ParentProps) {
  const navigate = useNavigate();
  const loc = useLocation();

  // 支持从扩展其他地方打开指定页：options.html?target=status
  // 只处理一次，避免 onSettled 在每次导航后重复跳转
  let handledTarget = false;
  onSettled(() => {
    if (handledTarget) return;
    const urlParams = new URLSearchParams(window.location.search);
    const target = urlParams.get('target');
    if (target) {
      handledTarget = true;
      navigate(`/${target}`, { replace: true });
    }
  });

  return (
    <div class="flex h-screen overflow-hidden bg-base-200">
      {/* 侧边栏 */}
      <nav class="w-60 h-full bg-base-100 border-r border-base-300 p-5 flex flex-col gap-2.5 shrink-0">
        <div>
          <h2 class="text-primary text-lg mb-5 font-bold">{getSoftName()}设置</h2>

          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <a
                href={link.to}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(link.to);
                }}
                class={`flex items-center gap-2.5 px-3 py-3 no-underline text-base-content/70 rounded-lg transition-all duration-200 hover:bg-primary/5${loc.pathname === link.to ? " active-link" : ""}`}
              >
                <Icon size={12} />
                {link.label}
              </a>
            );
          })}
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
