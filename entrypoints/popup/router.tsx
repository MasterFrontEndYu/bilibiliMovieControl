// entrypoints/popup/router.tsx
import { lazy } from "solid-js";
import { HashRouter, Route } from "@solidjs/router";
import Layout from "./App";

/**
 * popup 运行在 chrome-extension:// 协议下，同样用 hash 路由。
 */
const IndexPage = lazy(() => import("./pages/Index.tsx"));

export function AppRouter() {
    return (
        <HashRouter root={(props) => <Layout>{props.children}</Layout>}>
            <Route path="/" component={IndexPage} />
        </HashRouter>
    );
}
