// Shared by the React and Vue components: what their props mean, and how a
// component turns them into a mounted graph.
import type { GraphHost, GraphPage, GraphSource, OpenTarget, SemanticCategory } from './host'
import { createHost, type CreateHostOptions, type SemanticProvider } from './host-helpers'
import { mountKnowledge } from './knowledge/main'
import { mount3D } from './force3d/main'
import { mountSemantic } from './semantic/main'

export type GraphKind = '2d' | '3d' | 'semantic'

export interface CommonGraphProps {
  /** Your own host. Without one, the props below build it with createHost(). */
  host?: GraphHost
  /** Graph data by source id: the data, a URL, or a loader. */
  graphs?: CreateHostOptions['graphs']
  semantic?: SemanticProvider
  storage?: CreateHostOptions['storage']
  storagePrefix?: string
  accent?: string
  compact?: boolean
  debug?: boolean
}
export interface KnowledgeGraphProps extends CommonGraphProps {
  /** The graphs to switch between at the top left; the first is the default. */
  sources: GraphSource[]
  /** 2D: where the last-shown source is remembered. */
  sourceKey?: string
  /** 2D: open on this source instead of the remembered one. */
  initialSource?: string
  /** 3D: where the 3D page keeps its settings. */
  settingsKey?: string
}
export interface SemanticGraphProps extends CommonGraphProps {
  categories?: SemanticCategory[]
  scopes?: { id: string; label: string }[]
  defaultScope?: string
  settingsKey?: string
  allowBuild?: boolean
  buildIntro?: string
  buildHint?: string
}

/** Mount one graph into `el`. `onOpen` and `onNotify` are read on every call, so they can change. */
export function mountGraph(
  kind: GraphKind, el: HTMLElement, props: KnowledgeGraphProps | SemanticGraphProps,
  onOpen: (t: OpenTarget) => void, onNotify?: (type: string, payload?: Record<string, unknown>) => void,
): GraphPage {
  const host = props.host || createHost({
    graphs: props.graphs, semantic: props.semantic, storage: props.storage, storagePrefix: props.storagePrefix,
    accent: props.accent, compact: props.compact, debug: props.debug, onOpen, onNotify,
  })
  if (kind === 'semantic') {
    const p = props as SemanticGraphProps
    return mountSemantic(el, host, {
      settingsKey: p.settingsKey || 'kg.semantic.settings',
      categories: p.categories || [],
      scopes: p.scopes,
      defaultScope: p.defaultScope,
      allowBuild: !!p.allowBuild,
      buildIntro: p.buildIntro || 'Build the semantic layout, then reload.',
      buildHint: p.buildHint || 'The semantic layout has not been built yet.',
    })
  }
  const p = props as KnowledgeGraphProps
  return kind === '2d'
    ? mountKnowledge(el, host, { sources: p.sources, sourceKey: p.sourceKey || 'kg.2d.source', initialSource: p.initialSource })
    : mount3D(el, host, { sources: p.sources, settingsKey: p.settingsKey || 'kg.3d.settings' })
}

/** The box a graph fills: it positions itself against this and takes its size. */
export const BOX_STYLE = { position: 'relative', width: '100%', height: '100%', minHeight: '320px', overflow: 'hidden' } as const
