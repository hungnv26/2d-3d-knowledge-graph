import type { GraphHost, GraphPage, GraphSource, OpenTarget, SemanticCategory } from './host';
import { type CreateHostOptions, type SemanticProvider } from './host-helpers';
export type GraphKind = '2d' | '3d' | 'semantic';
export interface CommonGraphProps {
    /** Your own host. Without one, the props below build it with createHost(). */
    host?: GraphHost;
    /** Graph data by source id: the data, a URL, or a loader. */
    graphs?: CreateHostOptions['graphs'];
    semantic?: SemanticProvider;
    storage?: CreateHostOptions['storage'];
    storagePrefix?: string;
    accent?: string;
    compact?: boolean;
    debug?: boolean;
}
export interface KnowledgeGraphProps extends CommonGraphProps {
    /** The graphs to switch between at the top left; the first is the default. */
    sources: GraphSource[];
    /** 2D: where the last-shown source is remembered. */
    sourceKey?: string;
    /** 2D: open on this source instead of the remembered one. */
    initialSource?: string;
    /** 3D: where the 3D page keeps its settings. */
    settingsKey?: string;
}
export interface SemanticGraphProps extends CommonGraphProps {
    categories?: SemanticCategory[];
    scopes?: {
        id: string;
        label: string;
    }[];
    defaultScope?: string;
    settingsKey?: string;
    allowBuild?: boolean;
    buildIntro?: string;
    buildHint?: string;
}
/** Mount one graph into `el`. `onOpen` and `onNotify` are read on every call, so they can change. */
export declare function mountGraph(kind: GraphKind, el: HTMLElement, props: KnowledgeGraphProps | SemanticGraphProps, onOpen: (t: OpenTarget) => void, onNotify?: (type: string, payload?: Record<string, unknown>) => void): GraphPage;
/** The box a graph fills: it positions itself against this and takes its size. */
export declare const BOX_STYLE: {
    readonly position: "relative";
    readonly width: "100%";
    readonly height: "100%";
    readonly minHeight: "320px";
    readonly overflow: "hidden";
};
