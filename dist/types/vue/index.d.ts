import type { OpenTarget } from '../host';
export type { KnowledgeGraphProps, SemanticGraphProps } from '../wrappers';
/** 2D Knowledge Graph: your links or the Graphify graph, switched at the top left. */
export declare const KnowledgeGraph2D: import("vue").DefineComponent<{
    [x: string]: /*elided*/ any;
}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (_t: OpenTarget) => true;
    notify: (_type: string, _payload?: Record<string, unknown>) => true;
}, string, import("vue").PublicProps, Readonly<{
    [x: string]: /*elided*/ any;
}> & Readonly<{
    onOpen?: ((_t: OpenTarget) => any) | undefined;
    onNotify?: ((_type: string, _payload?: Record<string, unknown> | undefined) => any) | undefined;
}>, {
    compact: boolean;
    debug: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 3D Knowledge Graph: the same sources as a live 3D web. */
export declare const KnowledgeGraph3D: import("vue").DefineComponent<{
    [x: string]: /*elided*/ any;
}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (_t: OpenTarget) => true;
    notify: (_type: string, _payload?: Record<string, unknown>) => true;
}, string, import("vue").PublicProps, Readonly<{
    [x: string]: /*elided*/ any;
}> & Readonly<{
    onOpen?: ((_t: OpenTarget) => any) | undefined;
    onNotify?: ((_type: string, _payload?: Record<string, unknown> | undefined) => any) | undefined;
}>, {
    compact: boolean;
    debug: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/** 3D Semantic Graph: every note placed by meaning. */
export declare const SemanticGraph3D: import("vue").DefineComponent<{
    [x: string]: /*elided*/ any;
}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    open: (_t: OpenTarget) => true;
    notify: (_type: string, _payload?: Record<string, unknown>) => true;
}, string, import("vue").PublicProps, Readonly<{
    [x: string]: /*elided*/ any;
}> & Readonly<{
    onOpen?: ((_t: OpenTarget) => any) | undefined;
    onNotify?: ((_type: string, _payload?: Record<string, unknown> | undefined) => any) | undefined;
}>, {
    allowBuild: boolean;
    compact: boolean;
    debug: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
