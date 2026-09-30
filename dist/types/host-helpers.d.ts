import type { GraphHost, OpenTarget, Platform } from './host';
/** A node of a link graph or a Graphify graph, as the Knowledge Graphs read it. */
export interface GraphNodeData {
    id: string;
    title: string;
    /** Top folder or any grouping; informational. */
    category?: string;
    /** How many links touch it; the node limit keeps the most connected. */
    linkCount?: number;
    /** Note path, for path: searches and colour groups. Defaults to the id. */
    path?: string;
    tags?: string[];
    /** Graphify only: the note this node was extracted from. */
    note?: string | null;
    community?: number | null;
    communityName?: string;
    /** Graphify only: document, concept, rationale or paper. */
    type?: string;
    /** Anything else you keep on a node comes back in onOpen's `raw`. */
    [key: string]: unknown;
}
export interface GraphEdgeData {
    from: string;
    to: string;
    relation?: string;
    inferred?: boolean;
}
export interface GraphData {
    nodes: GraphNodeData[];
    edges: GraphEdgeData[];
}
export interface SemanticNodeData {
    id: string;
    label: string;
    path?: string;
    tags?: string[];
    x: number;
    y: number;
    z: number;
    cluster: number;
    degree: number;
    /** Category fields (folder, status, year …), read through the page's categories. */
    [field: string]: unknown;
}
export interface SemanticCluster {
    id: number;
    label: string;
    size: number;
    center_id: string;
}
export interface SemanticDataset {
    built_at?: string;
    model?: string;
    nodes: SemanticNodeData[];
    clusters: SemanticCluster[];
    links: {
        source: string;
        target: string;
    }[];
    /** Unit vectors, one per node in node order, for search and closest notes. */
    vectors?: {
        dims: number;
        encoding: 'int8-base64';
        data: string;
    };
}
export interface SemanticHit {
    id: string;
    label: string;
    score: number;
}
export interface SemanticStatus {
    ready: boolean;
    building: boolean;
    build_line: string | null;
    build_failed: string | null;
    stale?: boolean;
    built_at?: string;
    n_notes?: number;
    n_clusters?: number;
    n_links?: number;
}
/** What the 3D Semantic Graph asks of its data. createStaticSemantic() is one; a server can be another. */
export interface SemanticProvider {
    status(): Promise<SemanticStatus>;
    graph(scope?: string): Promise<SemanticDataset & {
        ready: boolean;
    }>;
    search?(query: string, limit: number, scope?: string): Promise<{
        results: SemanticHit[];
        error?: string;
    }>;
    neighbors?(id: string, limit: number): Promise<{
        results: SemanticHit[];
    }>;
    /** Start a rebuild of the layout; the page then polls status(). */
    build?(): Promise<{
        started?: boolean;
        error?: string;
    }>;
}
type GraphInput = GraphData | string | (() => Promise<GraphData>);
export interface Storage {
    get(key: string): string | null;
    set(key: string, value: string): void;
}
export interface CreateHostOptions {
    /** Graph data by source id: the data itself, a URL to fetch, or a loader. */
    graphs?: Record<string, GraphInput>;
    /** The 3D Semantic Graph's data. */
    semantic?: SemanticProvider;
    /** A node was opened. `target.note` is the note to show; `target.quote` a passage to highlight. */
    onOpen?: (target: OpenTarget) => void;
    /** Where settings are kept: the browser's localStorage (default), memory only, or your own. */
    storage?: 'local' | 'memory' | Storage;
    /** Prefix for every settings key, so two apps on one origin keep separate settings. */
    storagePrefix?: string;
    accent?: string;
    /** Phone-width layout; defaults to a window narrower than 700 px. */
    compact?: boolean;
    platform?: Platform;
    debug?: boolean;
    onNotify?: (type: string, payload?: Record<string, unknown>) => void;
}
export declare function createHost(opts?: CreateHostOptions): GraphHost;
export interface StaticSemanticOptions {
    /** Which nodes each scope keeps, by scope id. A scope without a rule keeps everything. */
    scopes?: Record<string, (node: SemanticNodeData) => boolean>;
    /**
     * Turns a query into a vector of the same model and size as the dataset's
     * vectors, for true search by meaning. Without it, search finds the notes
     * whose words match best and ranks everything by closeness to them.
     */
    embed?: (text: string) => Promise<number[]>;
}
/** Serves a prebuilt semantic layout: from the object itself or from a URL. */
export declare function createStaticSemantic(source: SemanticDataset | string, opts?: StaticSemanticOptions): SemanticProvider;
export {};
