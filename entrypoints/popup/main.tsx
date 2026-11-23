// entrypoints/popup/main.tsx
import { Suspense } from "solid-js";
import { render } from "solid-js/web";

import { AppRouter } from "./router";

import "@/assets/css/app.css";

const root = document.getElementById("root");

if (root) {
    render(
        () => (
            <Suspense
                fallback={
                    <main class="flex items-center justify-center p-4">
                        <span class="loading loading-infinity loading-md text-primary"></span>
                    </main>
                }
            >
                <AppRouter />
            </Suspense>
        ),
        root,
    );
}
