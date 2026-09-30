import { type CSSProperties, type ReactElement } from 'react';
import type { OpenTarget } from '../host';
import { type KnowledgeGraphProps, type SemanticGraphProps } from '../wrappers';
export type { KnowledgeGraphProps, SemanticGraphProps } from '../wrappers';
interface ElementProps {
    className?: string;
    style?: CSSProperties;
    /** A node was opened: show `target.note`, highlighting `target.quote` if you can. */
    onOpen?: (target: OpenTarget) => void;
    onNotify?: (type: string, payload?: Record<string, unknown>) => void;
}
/** 2D Knowledge Graph: your links or the Graphify graph, switched at the top left. */
export declare function KnowledgeGraph2D(props: KnowledgeGraphProps & ElementProps): ReactElement;
/** 3D Knowledge Graph: the same sources as a live 3D web. */
export declare function KnowledgeGraph3D(props: KnowledgeGraphProps & ElementProps): ReactElement;
/** 3D Semantic Graph: every note placed by meaning. */
export declare function SemanticGraph3D(props: SemanticGraphProps & ElementProps): ReactElement;
