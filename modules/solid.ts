import "wxt";
import { addImportPreset, addViteConfig, defineWxtModule } from "wxt/modules";
import solid from "@solidjs/vite-plugin";
import type { SolidModuleOptions } from "@/types/types";

export default defineWxtModule<SolidModuleOptions>({
  name: "solid-v2",
  configKey: "solid-v2",
  setup(wxt, options) {
    const { vite } = options ?? { start: true };

    addViteConfig(wxt, () => ({
      plugins: [solid(vite)],
      build: {
        target: "esnext"
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
