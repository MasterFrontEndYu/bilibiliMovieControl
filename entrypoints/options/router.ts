// entrypoints/options/router.ts
import { createRouter, defineRoutes, hashHistory } from "@solidjs/router";
import { lazy } from "solid-js";

import {
    BadgeAlert,
    Cloud,
    HouseHeart,
    RobotVacuum,
    ScanEye,
} from "@lucide/solid";
/**
 * options 页面运行在 chrome-extension:// 协议下，
 * 用 hashHistory()（URL 形如 options.html#/history）最稳妥：
 * 不会受浏览器对扩展页 history 的限制，刷新/深链都不会 404。
 */
const routes = defineRoutes([
    {
        path: "/",
        component: lazy(() => import("./pages/Index.tsx")),
        info: { title: "功能讲解", icon: HouseHeart, index: 1 },
    },
    {
        path: "/history",
        component: lazy(() => import("./pages/History.tsx")),
        info: { title: "自动存档", icon: RobotVacuum, index: 4 },
    },
    {
        path: "/cloud",
        component: lazy(() => import("./pages/Cloud.tsx")),
        info: { title: "云端片段", icon: Cloud, index: 2 },
    },
    {
        path: "/manual",
        component: lazy(() => import("./pages/Manual.tsx")),
        info: { title: "手动存档", icon: ScanEye, index: 5 },
    },
    {
        path: "/about",
        component: lazy(() => import("./pages/About.tsx")),
        info: { title: "关于", icon: BadgeAlert, index: 6 },
    },
]);

export const Router = createRouter({
    routes,
    history: hashHistory(),
});
