import { type GraphHost, type GraphPage, type GraphSource } from '../host';
export interface KnowledgeOptions {
    /** The graphs this page can draw; the first is the default. */
    sources: GraphSource[];
    /** Where the page remembers which source it showed last. */
    sourceKey: string;
    /** Open on this source instead of the remembered one. */
    initialSource?: string;
    /** The initial source's graph, when the host already has it. */
    initialData?: unknown;
}
export declare function mountKnowledge(root: HTMLElement, host: GraphHost, opts: KnowledgeOptions): GraphPage;
