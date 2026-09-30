/*! 2D-3D Knowledge Graph Package | (c) Hung Ngo | MIT License | https://github.com/hungnv26/2d-3d-knowledge-graph */

// src/vue/index.ts
import { defineComponent, h, onBeforeUnmount, onMounted, ref } from "vue";
import { BOX_STYLE, mountGraph } from "./index.js";
var common = {
  host: Object,
  graphs: Object,
  semantic: Object,
  storage: [String, Object],
  storagePrefix: String,
  accent: String,
  compact: { type: Boolean, default: void 0 },
  debug: Boolean
};
var knowledge = {
  ...common,
  sources: { type: Array, required: true },
  sourceKey: String,
  initialSource: String,
  settingsKey: String
};
var semantic = {
  ...common,
  categories: Array,
  scopes: Array,
  defaultScope: String,
  settingsKey: String,
  allowBuild: Boolean,
  buildIntro: String,
  buildHint: String
};
var make = (name, kind, props) => defineComponent({
  name,
  props,
  emits: { open: (_t) => true, notify: (_type, _payload) => true },
  setup(p, { emit }) {
    const el = ref(null);
    let page = null;
    onMounted(() => {
      if (!el.value) return;
      page = mountGraph(
        kind,
        el.value,
        p,
        (t) => emit("open", t),
        (type, payload) => emit("notify", type, payload)
      );
    });
    onBeforeUnmount(() => {
      page?.destroy();
      page = null;
    });
    return () => h("div", { ref: el, style: BOX_STYLE });
  }
});
var KnowledgeGraph2D = make("KnowledgeGraph2D", "2d", knowledge);
var KnowledgeGraph3D = make("KnowledgeGraph3D", "3d", knowledge);
var SemanticGraph3D = make("SemanticGraph3D", "semantic", semantic);
export {
  KnowledgeGraph2D,
  KnowledgeGraph3D,
  SemanticGraph3D
};
