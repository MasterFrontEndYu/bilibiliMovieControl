// entrypoints/options/router.ts
import { createRouter, defineRoutes, hashHistory } from "@solidjs/router";
import { lazy } from "solid-js";

import {
    BadgeAlert,
    BellDot,
    HouseHeart,
    Keyboard,
    RobotVacuum,
    ScanEye,
} from "@lucide/solid";
/**
 * options 页面运行在 chrome-extension:// 协议下，
 * 用 hashHistory()（URL 形如 options.html#/status）最稳妥：
 * 不会受浏览器对扩展页 history 的限制，刷新/深链都不会 404。
 */
const routes = defineRoutes([
    {
        path: "/",
        component: lazy(() => import("./pages/Index.tsx")),
        info: { title: "功能讲解", icon: HouseHeart, index: 1 },
    },
    {
        path: "/status",
        component: lazy(() => import("./pages/Status.tsx")),
        info: { title: "状态设置", icon: BellDot, index: 2 },
    },
    {
        path: "/history",
        component: lazy(() => import("./pages/History.tsx")),
        info: { title: "自动存档", icon: RobotVacuum, index: 4 },
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
    {
        path: "/shortcut",
        component: lazy(() => import("./pages/Shortcut.tsx")),
        info: { title: "快捷键设置", icon: Keyboard, index: 3 },
    },
]);

export const Router = createRouter({
    routes,
    history: hashHistory(),
});
