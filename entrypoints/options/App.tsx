import { onSettled, type ParentProps } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { OptionsFooter } from "@/components/OptionsFooter";

import { getSoftName } from "@/utils/bilibili";


import { Router } from "./router.ts";


export default function Layout(props: ParentProps) {
  const navigate = useNavigate();
  const loc = useLocation();

  const navRoutes = () =>
    Router.routes.filter((route) => route.info?.title).sort((a, b) => (a.info?.index ?? 0) - (b.info?.index ?? 0));


  return (
    <div class="flex h-screen overflow-hidden bg-base-200">
      {/* 侧边栏 */}
      <nav class="w-60 h-full bg-base-100 border-r border-base-300 flex flex-col gap-2.5 shrink-0">
        <div>
          <ul class="menu rounded-box w-full">
            <li class="menu-title font-bold text-primary text-lg mb-5">{getSoftName()}设置</li>
            <For each={navRoutes()}>
              {(link) => (
                <li >
                  <a
                    href={link.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(link.path);
                    }}

                    class={[
                      "py-3",
                      { "menu-active font-bold text-pink-400": loc.pathname === link.path }
                    ]}
                  >
                    <link.info.icon size={14} class="mr-1.5" />
                    {link.info.title}
                  </a>
                </li>
              )}
            </For>
          </ul>


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
