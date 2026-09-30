// 2D-3D Knowledge Graph Package by Hung Ngo (MIT).
// Three graph pages, each mounted into an element you give it:
//   mountKnowledge  2D Knowledge Graph (your links, or the Graphify graph)
//   mount3D         3D Knowledge Graph (the same sources as a live 3D web)
//   mountSemantic   3D Semantic Graph  (notes placed by meaning)
// createHost() builds the `host` they need from data you already have.
export { mountKnowledge, type KnowledgeOptions } from './knowledge/main'
export { mount3D, type Force3DOptions } from './force3d/main'
export { mountSemantic, type SemanticOptions } from './semantic/main'
export {
  createHost, createStaticSemantic,
  type CreateHostOptions, type GraphData, type GraphEdgeData, type GraphNodeData,
  type SemanticCluster, type SemanticDataset, type SemanticHit, type SemanticNodeData,
  type SemanticProvider, type SemanticStatus, type StaticSemanticOptions, type Storage,
} from './host-helpers'
export type { GraphHost, GraphPage, GraphSource, Group, OpenTarget, Platform, SemanticCategory } from './host'
// Used by the React and Vue components; also handy for mounting a graph by kind.
export { mountGraph, BOX_STYLE, type GraphKind, type KnowledgeGraphProps, type SemanticGraphProps, type CommonGraphProps } from './wrappers'
