// Vue components: <KnowledgeGraph2D>, <KnowledgeGraph3D>, <SemanticGraph3D>.
// Listen for @open to show a note. Props are read when the component mounts;
// change its `key` to remount it with new ones.
import { defineComponent, h, onBeforeUnmount, onMounted, ref, type ComponentObjectPropsOptions, type PropType } from 'vue'
import type { GraphHost, GraphSource, OpenTarget, SemanticCategory } from '../host'
import type { CreateHostOptions, SemanticProvider } from '../host-helpers'
import { BOX_STYLE, mountGraph, type GraphKind, type KnowledgeGraphProps, type SemanticGraphProps } from '../wrappers'

export type { KnowledgeGraphProps, SemanticGraphProps } from '../wrappers'

const common = {
  host: Object as PropType<GraphHost>,
  graphs: Object as PropType<CreateHostOptions['graphs']>,
  semantic: Object as PropType<SemanticProvider>,
  storage: [String, Object] as PropType<CreateHostOptions['storage']>,
  storagePrefix: String,
  accent: String,
  compact: { type: Boolean, default: undefined },
  debug: Boolean,
}
const knowledge = {
  ...common,
  sources: { type: Array as PropType<GraphSource[]>, required: true as const },
  sourceKey: String,
  initialSource: String,
  settingsKey: String,
}
const semantic = {
  ...common,
  categories: Array as PropType<SemanticCategory[]>,
  scopes: Array as PropType<{ id: string; label: string }[]>,
  defaultScope: String,
  settingsKey: String,
  allowBuild: Boolean,
  buildIntro: String,
  buildHint: String,
}

const make = <P extends ComponentObjectPropsOptions>(name: string, kind: GraphKind, props: P) => defineComponent({
  name,
  props,
  emits: { open: (_t: OpenTarget) => true, notify: (_type: string, _payload?: Record<string, unknown>) => true },
  setup(p: Record<string, unknown>, { emit }) {
    const el = ref<HTMLElement | null>(null)
    let page: { destroy(): void } | null = null
    onMounted(() => {
      if (!el.value) return
      page = mountGraph(kind, el.value, p as unknown as KnowledgeGraphProps | SemanticGraphProps,
        (t) => emit('open', t), (type, payload) => emit('notify', type, payload))
    })
    onBeforeUnmount(() => { page?.destroy(); page = null })
    return () => h('div', { ref: el, style: BOX_STYLE })
  },
})

/** 2D Knowledge Graph: your links or the Graphify graph, switched at the top left. */
export const KnowledgeGraph2D = make('KnowledgeGraph2D', '2d', knowledge)
/** 3D Knowledge Graph: the same sources as a live 3D web. */
export const KnowledgeGraph3D = make('KnowledgeGraph3D', '3d', knowledge)
/** 3D Semantic Graph: every note placed by meaning. */
export const SemanticGraph3D = make('SemanticGraph3D', 'semantic', semantic)
