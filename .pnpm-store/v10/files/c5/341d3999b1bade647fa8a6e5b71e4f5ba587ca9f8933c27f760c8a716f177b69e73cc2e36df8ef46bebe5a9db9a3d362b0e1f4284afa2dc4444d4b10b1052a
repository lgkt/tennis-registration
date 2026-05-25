var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/nuxt.ts
var nuxt_exports = {};
__export(nuxt_exports, {
  default: () => nuxt_default
});
module.exports = __toCommonJS(nuxt_exports);
var import_kolorist = require("kolorist");
var import_vite_plugin_vue_dev_locator2 = require("vite-plugin-vue-dev-locator");

// src/index.ts
var import_unplugin = require("unplugin");
var import_vite_plugin_vue_dev_locator = __toESM(require("vite-plugin-vue-dev-locator"));
var src_default = (0, import_unplugin.createUnplugin)((options) => {
  const plugins = (0, import_vite_plugin_vue_dev_locator.default)(options);
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

// src/nuxt.ts
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
    const normalizedOptions = { ...import_vite_plugin_vue_dev_locator2.DEFAULT_INSPECTOR_OPTIONS, ...options };
    const { toggleComboKey } = normalizedOptions;
    if (printed || !toggleComboKey)
      return;
    const keys = (0, import_vite_plugin_vue_dev_locator2.normalizeComboKeyPrint)(toggleComboKey);
    console.log(`  ${"> Vue Inspector"}: ${(0, import_kolorist.green)(`Press ${(0, import_kolorist.yellow)(keys)} in App to toggle the Inspector`)}
`);
    printed = true;
  });
};
