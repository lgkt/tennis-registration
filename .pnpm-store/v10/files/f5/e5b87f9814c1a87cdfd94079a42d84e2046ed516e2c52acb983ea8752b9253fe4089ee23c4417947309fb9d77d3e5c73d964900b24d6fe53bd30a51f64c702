// src/index.ts
import { createUnplugin } from "unplugin";
import VitePluginInspector from "vite-plugin-vue-dev-locator";
var src_default = createUnplugin((options) => {
  const plugins = VitePluginInspector(options);
  return [
    {
      name: "unplugin-vue-inspector",
      vite: plugins[0]
    },
    {
      name: "unplugin-vue-inspector:post",
      vite: plugins[1]
    }
  ];
});

export {
  src_default
};
