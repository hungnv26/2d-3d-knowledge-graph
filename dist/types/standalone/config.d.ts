import type { GraphHost, GraphSource, SemanticCategory } from '../host';
import { type GraphData, type SemanticDataset } from '../host-helpers';
export interface StandaloneSource extends GraphSource {
    /** The graph itself, or a URL to fetch it from. */
    data?: GraphData;
    url?: string;
}
export interface StandaloneConfig {
    /** 2D and 3D Knowledge Graphs: the sources to switch between. */
    sources?: StandaloneSource[];
    initialSource?: string;
    /** 3D Semantic Graph. A scope keeps the nodes whose `field` is one of `values`; no field keeps all. */
    semantic?: {
        data?: SemanticDataset;
        url?: string;
        categories?: SemanticCategory[];
        scopes?: {
            id: string;
            label: string;
            field?: string;
            values?: string[];
        }[];
        defaultScope?: string;
        buildIntro?: string;
        buildHint?: string;
    };
    /** Settings saved earlier, by key; otherwise the browser's storage is used. */
    settings?: Record<string, string>;
    compact?: boolean;
    accent?: string;
    platform?: 'macos' | 'ios' | 'web';
    debug?: boolean;
}
declare global {
    interface Window {
        KnowledgeGraphConfig?: StandaloneConfig;
        webkit?: {
            messageHandlers?: Record<string, {
                postMessage: (msg: unknown) => void;
            }>;
        };
    }
}
export declare function standaloneConfig(): StandaloneConfig;
export declare function standaloneHost(c: StandaloneConfig): GraphHost;
/** The full-page element a standalone script mounts into, with the page-wide styles. */
export declare function appRoot(): HTMLElement;
