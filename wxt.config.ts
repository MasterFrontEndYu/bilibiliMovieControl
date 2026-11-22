import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
    vite: () => ({
        plugins: [tailwindcss()],
    }),
    webExt: {
        binaries: {
            edge: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            firefox: "firefoxdeveloperedition",
        },
    },
    manifest: {
        browser_specific_settings: {
            gecko: {
                id: "bilibili-movie-control@sanguogege.com",
                data_collection_permissions: {
                    required: ["browsingActivity", "websiteContent"],
                    optional: ["technicalAndInteraction"],
                },
            },
        },
        permissions: ["storage", "tabs", "activeTab", "scripting"],
        host_permissions: ["*://*.bilibili.com/*", "https://bsbsb.top/*"],
        icons: {
            16: "icon/icon-16.png",
            32: "icon/icon-32.png",
            48: "icon/icon-48.png",
            96: "icon/icon-96.png",
            128: "icon/icon-128.png",
        },
    },
});
