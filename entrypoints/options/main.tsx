// entrypoints/options/main.tsx
// import { LucideProvider } from '@lucide/solid'; // 导入 Provider
import { Loading, render } from "@solidjs/web";
import { Router } from "./router";
import Layout from "./App";
import "@/assets/css/app.css";

const root = document.getElementById("root");

if (root) {
    render(
        () => (
            <Router>
                {(props) => (
                    <Loading fallback={<main>Loading…</main>}>
                        {/* 在这里包裹 LucideProvider */}
                        {/* <LucideProvider> */}
                            <Layout>{props.children}</Layout>
                        {/* </LucideProvider> */}
                    </Loading>
                )}
            </Router>
        ),
        root,
    );
}