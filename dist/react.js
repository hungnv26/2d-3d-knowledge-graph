/*! 2D-3D Knowledge Graph Package | (c) Hung Ngo | MIT License | https://github.com/hungnv26/2d-3d-knowledge-graph */

// src/react/index.ts
import { createElement, useEffect, useRef } from "react";
import { BOX_STYLE, mountGraph } from "./index.js";
function useGraph(kind, props) {
  const el = useRef(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!el.current) return;
    const page = mountGraph(
      kind,
      el.current,
      latest.current,
      (t) => latest.current.onOpen?.(t),
      (type, payload) => latest.current.onNotify?.(type, payload)
    );
    return () => page.destroy();
  }, [kind]);
  return createElement("div", { ref: el, className: props.className, style: { ...BOX_STYLE, ...props.style } });
}
function KnowledgeGraph2D(props) {
  return useGraph("2d", props);
}
function KnowledgeGraph3D(props) {
  return useGraph("3d", props);
}
function SemanticGraph3D(props) {
  return useGraph("semantic", props);
}
export {
  KnowledgeGraph2D,
  KnowledgeGraph3D,
  SemanticGraph3D
};
