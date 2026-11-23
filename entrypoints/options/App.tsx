import { For, type ParentProps } from "solid-js";
import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { OptionsFooter } from "@/components/OptionsFooter";
import { buildCloudPath, getCloudContext } from "@/utils/cloudContext";

import { getSoftName } from "@/utils/bilibili";

import { NAV_ITEMS } from "./nav";

export default function Layout(props: ParentProps) {
    const navigate = useNavigate();
    const loc = useLocation();
    const [searchParams] = useSearchParams();

    const param = (key: string) => {
        const value = (searchParams as Record<string, unknown>)[key];
        return typeof value === "string" ? value : "";
    };

    /** 云端片段侧边栏保留当前（或最近一次）的 BV / 分P */
    const navHref = (path: string) => {
        if (path !== "/cloud") return path;

        const bvid = param("bvid") || getCloudContext().bvid;
        const page = Number(param("page")) || getCloudContext().page;
        return bvid ? buildCloudPath(bvid, page) : "/cloud";
    };

    const navRoutes = () =>
        [...NAV_ITEMS].sort((a, b) => a.index - b.index);

    return (
        <div class="flex h-screen overflow-hidden bg-base-200">
            {/* 侧边栏 */}
            <nav class="w-60 h-full bg-base-100 border-r border-base-300 flex flex-col gap-2.5 shrink-0">
                <div>
                    <ul class="menu rounded-box w-full">
                        <li class="menu-title font-bold text-primary text-lg mb-5">
                            {getSoftName()}设置
                        </li>
                        <For each={navRoutes()}>
                            {(link) => (
                                <li>
                                    <a
                                        href={navHref(link.path)}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            navigate(navHref(link.path));
                                        }}
                                        class="py-3"
                                        classList={{
                                            "menu-active font-bold text-pink-400":
                                                loc.pathname === link.path,
                                        }}
                                    >
                                        <link.icon size={14} class="mr-1.5" />
                                        {link.title}
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
        </div>
    );
}
