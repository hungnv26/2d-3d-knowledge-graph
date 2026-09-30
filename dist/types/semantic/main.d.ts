import { type GraphHost, type GraphPage, type SemanticCategory } from '../host';
export interface SemanticOptions {
    /** Where this page's settings are kept. */
    settingsKey: string;
    /** Ways to colour the notes besides their clusters; the first is shown in the side card. */
    categories: SemanticCategory[];
    /** Parts of the notes to draw, if the host offers a choice; sent as `scope`. */
    scopes?: {
        id: string;
        label: string;
    }[];
    /** The scope a first visit opens on; defaults to the first. */
    defaultScope?: string;
    /** Whether this host may rebuild the layout. */
    allowBuild: boolean;
    /** Shown when the layout has not been built: to someone who can build it, and to someone who cannot. */
    buildIntro: string;
    buildHint: string;
    /** Status and graph the host already has. */
    initialStatus?: unknown;
    initialData?: unknown;
}
export declare function mountSemantic(root: HTMLElement, host: GraphHost, opts: SemanticOptions): GraphPage;
