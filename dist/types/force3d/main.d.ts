import { type GraphHost, type GraphPage, type GraphSource } from '../host';
export interface Force3DOptions {
    /** The graphs this page can draw; the first is the default and gives the default colours. */
    sources: GraphSource[];
    /** Where this page's settings are kept. */
    settingsKey: string;
    /** The first source's graph, when the host already has it. */
    initialData?: unknown;
}
export declare function mount3D(root: HTMLElement, host: GraphHost, opts: Force3DOptions): GraphPage;
