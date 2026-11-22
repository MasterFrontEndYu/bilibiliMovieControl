import { createRouter, defineRoutes, hashHistory } from "@solidjs/router";
import { lazy } from "solid-js";

/**
 * popup 页面运行在 chrome-extension:// 协议下，
 * 用 hashHistory()（URL 形如 popup.html#/）最稳妥：
 * 不会受浏览器对扩展页 history 的限制，刷新/深链都不会 404。
 */
const routes = defineRoutes([
    { path: "/", component: lazy(() => import("./pages/Index.tsx")) },
]);

export const Router = createRouter({
    routes,
    history: hashHistory(),
});
