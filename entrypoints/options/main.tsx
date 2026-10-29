// entrypoints/options/main.tsx
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
                            <Layout>{props.children}</Layout>
                    </Loading>
                )}
            </Router>
        ),
        root,
    );
}