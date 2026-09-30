// React components: <KnowledgeGraph2D>, <KnowledgeGraph3D>, <SemanticGraph3D>.
// Props are read when the component mounts (except onOpen / onNotify, which
// may change); give the component a new `key` to remount it with new ones.
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement } from 'react'
import type { OpenTarget } from '../host'
import { BOX_STYLE, mountGraph, type GraphKind, type KnowledgeGraphProps, type SemanticGraphProps } from '../wrappers'

export type { KnowledgeGraphProps, SemanticGraphProps } from '../wrappers'

interface ElementProps {
  className?: string
  style?: CSSProperties
  /** A node was opened: show `target.note`, highlighting `target.quote` if you can. */
  onOpen?: (target: OpenTarget) => void
  onNotify?: (type: string, payload?: Record<string, unknown>) => void
}

function useGraph(kind: GraphKind, props: (KnowledgeGraphProps | SemanticGraphProps) & ElementProps): ReactElement {
  const el = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props
  useEffect(() => {
    if (!el.current) return
    const page = mountGraph(kind, el.current, latest.current,
      (t) => latest.current.onOpen?.(t),
      (type, payload) => latest.current.onNotify?.(type, payload))
    return () => page.destroy()
  }, [kind])
  return createElement('div', { ref: el, className: props.className, style: { ...BOX_STYLE, ...props.style } })
}

/** 2D Knowledge Graph: your links or the Graphify graph, switched at the top left. */
export function KnowledgeGraph2D(props: KnowledgeGraphProps & ElementProps): ReactElement { return useGraph('2d', props) }
/** 3D Knowledge Graph: the same sources as a live 3D web. */
export function KnowledgeGraph3D(props: KnowledgeGraphProps & ElementProps): ReactElement { return useGraph('3d', props) }
/** 3D Semantic Graph: every note placed by meaning. */
export function SemanticGraph3D(props: SemanticGraphProps & ElementProps): ReactElement { return useGraph('semantic', props) }
