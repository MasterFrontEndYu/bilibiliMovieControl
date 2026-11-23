// entrypoints/options/main.tsx
import { Suspense } from "solid-js";
import { render } from "solid-js/web";

import { AppRouter } from "./router";
import "@/assets/css/app.css";

const root = document.getElementById("root");

if (root) {
    render(
        () => (
            <Suspense fallback={<main>Loading…</main>}>
                <AppRouter />
            </Suspense>
        ),
        root,
    );
}
