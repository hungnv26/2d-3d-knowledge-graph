export type Platform = 'macos' | 'ios' | 'web';
export interface Group {
    query: string;
    color: string;
}
/** A node the user asked to open. The host decides where it goes. */
export interface OpenTarget {
    id: string;
    /** The note to open, or null when the node has none. */
    note: string | null;
    title: string;
    /** A passage to find and highlight in the note (Graphify nodes send their name). */
    quote: string;
    path?: string;
    /** The node as the host delivered it, for host-specific fields (a matter's code…). */
    raw?: unknown;
}
export interface GraphHost {
    platform: Platform;
    /** A phone-width screen: panels start closed and taps select first. */
    compact: boolean;
    /** Accent colour as #rrggbb. */
    accent?: string;
    /** Ask the host for data: `graph` ({ source }), `semanticStatus`, `semanticGraph` … */
    request<T>(type: string, payload?: Record<string, unknown>): Promise<T>;
    open(target: OpenTarget): void;
    loadSetting(key: string): string | null;
    saveSetting(key: string, value: unknown): void;
    /** Informational: `ready`, `failed`. */
    notify?(type: string, payload?: Record<string, unknown>): void;
    /** Expose inspection handles on window (__kg2d, __kg3d, __kgSemantic) for tests and devtools. */
    debug?: boolean;
}
/** One graph a Knowledge Graph page can draw, switched at its top left. */
export interface GraphSource {
    id: string;
    label: string;
    /** Tooltip on the switch. */
    title?: string;
    /** Where this source's own settings are kept. */
    settingsKey: string;
    /** Bump when the default colours change, so saved settings pick them up. */
    settingsVersion?: number;
    /** Graphify semantics: communities, kinds, inferred links, hubs, note + quote on open. */
    graphify?: boolean;
    /** Default colour groups, first match wins. */
    groups: Group[];
    /** What a node is called in the status line. */
    noun?: string;
    /** Shown while the graph loads, and when it has nothing in it. */
    loadingText?: string;
    emptyText?: string;
}
/** A way to colour the 3D Semantic Graph besides its clusters. */
export interface SemanticCategory {
    id: string;
    label: string;
    /** The node field it reads (`folder`, `kind`, `status`, `year` …). */
    field: string;
    /** Fixed colours by value; values without one take the palette. */
    colors?: Record<string, string>;
    /** A colour rule, tried before `colors` (for example, colour a status by its prefix). */
    colorOf?: (value: string) => string | undefined;
    /** Display names by value. */
    labels?: Record<string, string>;
}
export declare const icons: {
    chevronDown: string;
    chevronRight: string;
    close: string;
    reset: string;
    search: string;
    plus: string;
    minus: string;
    fit: string;
    gear: string;
    play: string;
    pause: string;
    stop: string;
    open: string;
    layers: string;
};
export declare const escapeHtml: (s: string) => string;
/** Add a page's stylesheet once, however often it is mounted. */
export declare function injectStyle(id: string, css: string): void;
/** Handle returned by every mount: tears the page down completely. */
export interface GraphPage {
    destroy(): void;
}
