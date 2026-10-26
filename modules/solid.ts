import "wxt";
import { addImportPreset, addViteConfig, defineWxtModule } from "wxt/modules";
import solid, { type Options as PluginOptions } from "@solidjs/vite-plugin";

export default defineWxtModule<SolidModuleOptions>({
  name: "solid-v2",
  configKey: "solid-v2",
  setup(wxt, options) {
    const { vite } = options ?? { start: true };

    addViteConfig(wxt, () => ({
      plugins: [solid(vite)],
      build: {
        target: "esnext",
        rollupOptions: {
          treeshake: false, // 仅用于诊断或临时应急
        },
      },
    }));

    addImportPreset(wxt, "solid-js");

    // Enable auto-imports for JSX files
    wxt.hook("config:resolved", (wxt) => {
      // In older versions of WXT, `wxt.config.imports` could be false
      if (!wxt.config.imports) return;

      wxt.config.imports.dirsScanOptions ??= {};
      wxt.config.imports.dirsScanOptions.filePatterns = [
        // Default plus JSX/TSX
        "*.{ts,js,mjs,cjs,mts,cts,jsx,tsx}",
      ];
    });
  },
});

export interface SolidModuleOptions {
  vite?: PluginOptions;
}

declare module "wxt" {
  export interface InlineConfig {
    solid?: SolidModuleOptions;
  }
}
