import { Loading, render } from "@solidjs/web";

import { Router } from "./router";
import Layout from "./App";

import "@/assets/css/app.css";

const root = document.getElementById("root");

if (root) {
    render(
        () => (
            // base 必须匹配你打包后的 html 文件名
            <Router >
                {(props) => (
                    <>
                        <Layout>{props.children}</Layout>
                    </>
                )
                }
            </Router>

        ),
        root,
    );
}
