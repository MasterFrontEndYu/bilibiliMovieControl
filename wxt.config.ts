import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";


// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ["@wxt-dev/module-solid"],
    vite: () => ({
        plugins: [tailwindcss()],
    }),
    webExt: {
        binaries: {
            edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        },
    },
    manifest: {
        manifest_version: 3,
        browser_specific_settings: {
            gecko: {
                id: "bilibili-movie-control@sanguogege.com",
            },
        },
        options_ui: {
            page: "entrypoints/options/index.html",
            open_in_tab: true,
        },
        permissions: ["storage", "tabs", "activeTab", "scripting"],
        host_permissions: ["*://*.bilibili.com/*"],
        icons: {
            16: "icon/icon-16-active.png",
            32: "icon/icon-32-active.png",
            48: "icon/icon-48-active.png",
            96: "icon/icon-96-active.png",
            128: "icon/icon-128-active.png",
        },
    },
});
