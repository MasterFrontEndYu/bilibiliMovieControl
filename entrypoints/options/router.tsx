// entrypoints/options/router.tsx
import { lazy } from "solid-js";
import { HashRouter, Route } from "@solidjs/router";
import Layout from "./App";

/**
 * options 页面运行在 chrome-extension:// 协议下，
 * 用 HashRouter（URL 形如 options.html#/history）最稳妥：
 * 不会受浏览器对扩展页 history 的限制，刷新/深链都不会 404。
 */
const HomePage = lazy(() => import("./pages/Index.tsx"));
const HistoryPage = lazy(() => import("./pages/History.tsx"));
const CloudPage = lazy(() => import("./pages/Cloud.tsx"));
const UiPage = lazy(() => import("./pages/Ui.tsx"));
const SegmentPage = lazy(() => import("./pages/Segment.tsx"));
const ManualPage = lazy(() => import("./pages/Manual.tsx"));
const AboutPage = lazy(() => import("./pages/About.tsx"));

export function AppRouter() {
    return (
        <HashRouter root={(props) => <Layout>{props.children}</Layout>}>
            <Route path="/" component={HomePage} />
            <Route path="/history" component={HistoryPage} />
            <Route path="/cloud" component={CloudPage} />
            <Route path="/ui" component={UiPage} />
            <Route path="/segment" component={SegmentPage} />
            <Route path="/manual" component={ManualPage} />
            <Route path="/about" component={AboutPage} />
        </HashRouter>
    );
}
