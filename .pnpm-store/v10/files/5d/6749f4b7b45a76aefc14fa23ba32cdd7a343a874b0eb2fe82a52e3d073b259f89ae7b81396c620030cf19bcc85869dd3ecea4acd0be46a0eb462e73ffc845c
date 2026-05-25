import {
  src_default
} from "./chunk-SYMZKI4W.mjs";

// src/nuxt.ts
import { green, yellow } from "kolorist";
import { DEFAULT_INSPECTOR_OPTIONS, normalizeComboKeyPrint } from "vite-plugin-vue-dev-locator";
var nuxt_default = (options, nuxt) => {
  nuxt.hook("vite:extendConfig", async (config) => {
    config.plugins = config.plugins || [];
    config.plugins.push(...src_default.vite({
      appendTo: /\/entry\.m?js$/,
      ...options
    }));
  });
  let printed = false;
  nuxt.hook("vite:serverCreated", () => {
    const normalizedOptions = { ...DEFAULT_INSPECTOR_OPTIONS, ...options };
    const { toggleComboKey } = normalizedOptions;
    if (printed || !toggleComboKey)
      return;
    const keys = normalizeComboKeyPrint(toggleComboKey);
    console.log(`  ${"> Vue Inspector"}: ${green(`Press ${yellow(keys)} in App to toggle the Inspector`)}
`);
    printed = true;
  });
};
export {
  nuxt_default as default
};
