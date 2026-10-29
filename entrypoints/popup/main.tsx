import { Loading, render } from "@solidjs/web";

import { Router } from "./router";
import Layout from "./App";

import "@/assets/css/app.css";

const root = document.getElementById("root");

if (root) {
    render(
        () => (
            // base 必须匹配你打包后的 html 文件名
            <Router>
                {(props) => (
                    <Loading
                        fallback={
                            <main class="flex items-center justify-center p-4">
                                <span class="loading loading-infinity loading-md text-primary"></span>
                            </main>
                        }
                    >
                        <Layout>{props.children}</Layout>
                    </Loading>
                )}
            </Router>
        ),
        root,
    );
}
