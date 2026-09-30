/*! 2D-3D Knowledge Graph Package | (c) Hung Ngo | MIT License | https://github.com/hungnv26/2d-3d-knowledge-graph */

// src/knowledge/main.ts
import { forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

// src/host.ts
var path = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
var icons = {
  chevronDown: path('<path d="m6 9 6 6 6-6"/>'),
  chevronRight: path('<path d="m9 6 6 6-6 6"/>'),
  close: path('<path d="M18 6 6 18M6 6l12 12"/>'),
  reset: path('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  search: path('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  plus: path('<path d="M12 5v14M5 12h14"/>'),
  minus: path('<path d="M5 12h14"/>'),
  fit: path('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  gear: path('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  play: path('<path d="m7 4 13 8-13 8z" fill="currentColor"/>'),
  pause: path('<path d="M7 4v16M17 4v16"/>'),
  stop: path('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>'),
  open: path('<path d="M7 17 17 7M8 7h9v9"/>'),
  layers: path('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>')
};
var escapeHtml = (s) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

// src/knowledge/knowledge.css
var knowledge_default = `/* Everything is scoped to the page root, so a graph can live inside any app's
   layout as well as fill a whole page or web view. */
.og { --accent: #8b7cf6; color-scheme: dark;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.og, .og *, .og *::before, .og *::after { box-sizing: border-box; }
.og button { font: inherit; color: inherit; }

.og { position: absolute; inset: 0; background: #1e1e1e; color: #dcdcdc; }
.og__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.og__canvas.is-grabbing { cursor: grabbing; }
.og__canvas.is-pointer { cursor: pointer; }
.og__hud { position: absolute; left: 12px; right: 130px; bottom: 10px; font-size: 11px; letter-spacing: .03em; color: #8a8a8a; pointer-events: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* A phone has no room beside the zoom buttons: the line sits above them. */
@media (max-width: 560px) { .og__hud { right: 12px; bottom: 50px; } }
.og__msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #8a8a8a; font-size: 14px; pointer-events: none; }

.og__zoom { position: absolute; right: 12px; bottom: 10px; display: flex; gap: 4px; }
.og__zoom button, .og__gear {
  width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; border: 1px solid #363636; background: #2a2a2a; color: #b8b8b8; cursor: pointer; padding: 0;
}
.og__zoom button:hover, .og__gear:hover { background: #333; color: #fff; }
.og__gear { position: absolute; top: 12px; right: 12px; }

/* Obsidian's graph settings panel: floating, top-right, collapsible sections. */
.og__panel {
  position: absolute; top: 12px; right: 12px; width: min(300px, calc(100vw - 24px)); max-height: calc(100% - 24px); overflow: auto;
  border-radius: 10px; border: 1px solid #363636; background: rgba(38, 38, 38, .96);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, .45); font-size: 13px; color: #dcdcdc;
  -webkit-user-select: none; user-select: none;
}
.og__sec { border-bottom: 1px solid #363636; }
.og__sec:last-child { border-bottom: 0; }
.og__sec-h { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 10px 8px; }
.og__sec-t { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; font-size: 15px; font-weight: 600; cursor: pointer; padding: 0; }
.og__sec-tools { display: inline-flex; gap: 2px; }
.og__sec-tools button, .og__x {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 6px;
  background: transparent; color: #a0a0a0; cursor: pointer; padding: 0; flex-shrink: 0;
}
.og__sec-tools button:hover, .og__x:hover { background: #3a3a3a; color: #fff; }
.og__sec-b { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 10px; }
.og__sec.is-closed .og__sec-b { display: none; }

.og__search { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 8px; background: #1b1b1b; color: #8a8a8a; }
.og__search input, .og__group-q {
  flex: 1; min-width: 0; border: 0; background: transparent; color: #e6e6e6; font: inherit; outline: none;
  -webkit-user-select: text; user-select: text;
}
.og__clear { border: 0; background: transparent; color: #8a8a8a; cursor: pointer; display: inline-flex; padding: 0; }
.og__hint { font-size: 11px; color: #7a7a7a; line-height: 15px; }
.og__row { display: flex; align-items: center; justify-content: space-between; min-height: 28px; }

/* Switch */
.og__switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
.og__switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.og__switch span { position: absolute; inset: 0; border-radius: 10px; background: #4a4a4a; transition: background .18s ease; pointer-events: none; }
.og__switch span::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .18s ease; }
.og__switch input:checked + span { background: var(--accent); }
.og__switch input:checked + span::after { transform: translateX(16px); }

/* Force animation transport, like the 3D graph's orbit controls. */
.og__transport { display: inline-flex; align-items: center; gap: 2px; height: 32px; padding: 0 3px; border: 1px solid #3a3a3a; border-radius: 16px; background: #1b1b1b; }
.og__tbtn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 14px; background: transparent; color: #b8b8b8; cursor: pointer; padding: 0; }
.og__tbtn svg { width: 15px; height: 15px; }
.og__tbtn:hover:not(:disabled) { background: #333; color: #fff; }
.og__tbtn.is-active { background: color-mix(in srgb, var(--accent) 28%, transparent); color: #fff; }
.og__tbtn:disabled { opacity: .35; cursor: default; }
.og__speed { min-width: 38px; text-align: center; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; color: #fff; }

.og__slider { display: flex; flex-direction: column; gap: 4px; }
.og__slider input[type=range] { width: 100%; accent-color: var(--accent); margin: 0; }

.og__group { display: flex; align-items: center; gap: 8px; }
.og__group-q { height: 32px; padding: 0 10px; border-radius: 8px; background: #1b1b1b; }
.og__group-q:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent); }
.og__swatch { position: relative; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35); }
.og__swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; padding: 0; border: 0; }
.og__new { height: 32px; border-radius: 8px; border: 0; background: #1b1b1b; cursor: pointer; }
.og__new:hover { background: #333; }

/* Touch: a tapped note shows a card with an Open button. */
.og__card {
  position: absolute; left: 12px; right: 12px; bottom: 52px; margin: 0 auto; max-width: 460px;
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px;
  border: 1px solid #363636; background: rgba(38, 38, 38, .97); box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
}
.og__card[hidden] { display: none; }
.og__card-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.og__card-t { flex: 1; min-width: 0; }
.og__card-title { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.og__card-sub { font-size: 11px; color: #9a9a9a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.og__card-open { height: 32px; padding: 0 14px; border-radius: 8px; border: 0; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; flex-shrink: 0; }

.og__select { height: 28px; max-width: 150px; padding: 0 8px; border-radius: 8px; border: 1px solid #363636; background: #1b1b1b; color: #e6e6e6; font: inherit; }
.og__card-open:disabled { background: #3a3a3a; color: #9a9a9a; cursor: default; }

/* Colour by: a section of the settings panel (Graphify only). */
.og__lmodes { display: flex; gap: 4px; padding: 2px; margin-bottom: 8px; border-radius: 8px; background: #1b1b1b; }
.og__lmode { flex: 1; height: 26px; border: 0; border-radius: 6px; background: transparent; color: #9aa3b2; cursor: pointer; font-size: 12px; }
.og__lmode:hover { color: #e4e8ef; }
.og__lmode.is-active { background: #3a3a3a; color: #fff; }
.og__lrow { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
.og__lrow.is-static { cursor: default; color: #8d96a5; }
.og__lrow.is-dim { opacity: .42; }
.og__lrow.is-focus .og__llabel { color: #fff; font-weight: 600; }
.og__lswatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.og__llabel { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.og__ln { color: #8d96a5; font-variant-numeric: tabular-nums; }
.og__lhint { margin: 8px 0; font-size: 11px; line-height: 15px; color: #7e8797; }
.og__lhint b { color: #aab3c2; font-weight: 600; }
.og__lkey { display: flex; align-items: center; gap: 8px; padding: 2px 0; font-size: 11px; color: #9aa3b2; }
.og__lline { width: 22px; height: 0; border-top: 2px solid rgba(255, 255, 255, .35); flex-shrink: 0; }
.og__lline--inferred { border-top-color: rgba(255, 214, 120, .9); }
.og__lhub { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; background: #e0b152; box-shadow: 0 0 0 1.5px rgba(255, 255, 255, .75); }

/* Which graph the page draws: the links you wrote, or Graphify's. */
.og__source { position: absolute; top: 12px; left: 12px; display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: rgba(38, 38, 38, .96); border: 1px solid #363636; }
.og__srcb { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: #a3a3a3; cursor: pointer; font-size: 12px; }
.og__srcb:hover:not(:disabled) { color: #fff; }
.og__srcb.is-active { background: #3a3a3a; color: #fff; }
.og__srcb:disabled { opacity: .5; cursor: default; }

/* The settings panel opens over the source switch and the legend, not under them. */
.og__source { z-index: 2; }
.og__panel { z-index: 3; }
`;

// src/knowledge/main.ts
function mountKnowledge(root, host, opts) {
  const compact = host.compact;
  let destroyed = false;
  const SOURCES = opts.sources;
  const SOURCE_KEY = opts.sourceKey;
  const sourceById = (id) => SOURCES.find((x) => x.id === id);
  const savedSource = () => {
    try {
      return sourceById(JSON.parse(host.loadSetting(SOURCE_KEY) || '""'));
    } catch {
      return void 0;
    }
  };
  let SRC = sourceById(opts.initialSource) || savedSource() || SOURCES[0];
  let GRAPHIFY = false;
  let NOUN = "";
  let SETTINGS_KEY = "";
  let SETTINGS_VERSION = 1;
  const useSource = (src) => {
    SRC = src;
    GRAPHIFY = !!src.graphify;
    NOUN = src.noun || (GRAPHIFY ? "nodes" : "notes");
    SETTINGS_KEY = src.settingsKey;
    SETTINGS_VERSION = src.settingsVersion || 1;
  };
  useSource(SRC);
  const LIMIT_OPTIONS = [400, 800, 1500, 3e3];
  const MIN_SCREEN_R = 2.4;
  const GRAB_PX = 7;
  const TOUCH_GRAB_PX = 14;
  const WARMUP_TICKS = 150;
  const WARMUP_DECAY = 0.02;
  const WARMUP_FRICTION = 0.4;
  const CALM_FRICTION = 0.6;
  const COOL_DECAY = 6e-3;
  const BIG_GRAPH = 1200;
  const DRAG_ALPHA = 0.04;
  const NEIGHBOUR_LABELS_MAX = 30;
  const HUB_MIN_LEAVES = 3;
  const SPOKE_DISTANCE = 0.45;
  const SPOKE_STRENGTH = 1.6;
  const HUB_RING = "rgba(255,255,255,0.75)";
  const ANIM_CENTER = [0.4, 1];
  const ANIM_REPEL = [20, 4];
  const ANIM_CYCLE_S = 30;
  const ANIM_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8];
  const ANIM_BLEND_MS = 2500;
  const ANIM_HEAT = 0.05;
  const ANIM_HEAT_BIG = 0.02;
  const ACCENT = "#8b7cf6";
  const BRIGHT = ["#e05252", "#e0b152", "#52e052", "#52e0b1", "#52b1e0", "#5a5ae2", "#b152e0", "#e052b1", "#f28c3a", "#a8e04a", "#4fb3e8", "#e84fb0", "#ffe066", "#6f8bff"];
  const BRIGHT_BASE = "#4a4a4a";
  const KIND_COLOR = { document: "#e6e6e6", concept: "#52e052", rationale: "#e0b152", paper: "#b152e0" };
  const KIND_LABEL = { document: "Notes", concept: "Concepts", rationale: "Rationales", paper: "Papers and studies" };
  const KIND_HINT = {
    document: "the note itself",
    concept: "an idea, person or term in a note",
    rationale: "a reason a note gives",
    paper: "a study a note cites"
  };
  const LEGEND_ROWS = 12;
  const NEW_GROUP_COLORS = ["#e05252", "#e0b152", "#b1e052", "#52e052", "#52e0b1", "#52b1e0", "#5a5ae2", "#b152e0", "#e052b1", "#f28c3a"];
  const THEME = { node: "#9a9a9a", tag: "#7fffd4", link: "rgba(255,255,255,0.13)", inferred: "rgba(255,214,120,0.45)", text: "#e6e6e6", textDim: "rgba(230,230,230,0.35)", ring: "#ffffff" };
  const defaults = () => ({
    v: SETTINGS_VERSION,
    search: "",
    tags: false,
    orphans: true,
    limit: GRAPHIFY && compact ? 800 : 0,
    // Both graphs colour by folder. Graphify can also colour by community or kind.
    colorBy: "groups",
    groups: SRC.groups.map((g) => ({ ...g })),
    display: { nodeSize: 1, linkThickness: 1, textFade: 0, motion: true, hubs: GRAPHIFY },
    forces: { center: 0.5, repel: 10, link: 1, linkDistance: 250 },
    // The animation runs when the graph opens, until the user pauses or stops it.
    animate: { speed: 1, playing: true },
    open: { filters: true, groups: !compact, display: false, forces: false, legend: false }
  });
  const loadSettings = () => {
    const d = defaults();
    try {
      const raw = host.loadSetting(SETTINGS_KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      if ((s.v || 0) < SETTINGS_VERSION) {
        s.groups = d.groups;
        s.colorBy = d.colorBy;
      }
      return {
        ...d,
        ...s,
        v: SETTINGS_VERSION,
        search: typeof s.search === "string" ? s.search : "",
        colorBy: !GRAPHIFY ? "groups" : ["community", "kind", "groups"].includes(s.colorBy) ? s.colorBy : d.colorBy,
        limit: typeof s.limit === "number" && s.limit >= 0 ? s.limit : d.limit,
        display: { ...d.display, ...s.display || {} },
        forces: { ...d.forces, ...s.forces || {} },
        animate: {
          speed: ANIM_SPEEDS.includes(s.animate?.speed) ? s.animate.speed : d.animate.speed,
          playing: typeof s.animate?.playing === "boolean" ? s.animate.playing : d.animate.playing
        },
        open: { ...d.open, ...s.open || {} },
        groups: Array.isArray(s.groups) ? s.groups.filter((g) => g && typeof g.query === "string" && typeof g.color === "string") : d.groups
      };
    } catch {
      return d;
    }
  };
  const S = loadSettings();
  const anim = {
    state: "stopped",
    phase: 0,
    // 0 → 1 around one there-and-back cycle
    blend: 0,
    // 0 → 1 while gliding in or back out
    base: null,
    // the user's own values, restored by Stop
    from: null
    // where the current glide started
  };
  const persist = () => host.saveSetting(SETTINGS_KEY, anim.base ? { ...S, forces: { ...S.forces, ...anim.base } } : S);
  const parseQuery = (q) => {
    const terms = [];
    const re = /(-)?(?:(path|file|tag|community|type):)?(?:"([^"]*)"|(\S+))/g;
    let m;
    while (m = re.exec(q)) {
      const value = (m[3] ?? m[4] ?? "").toLowerCase();
      if (!value) continue;
      terms.push({ neg: !!m[1], field: m[2] || "any", value });
    }
    return terms;
  };
  const tagHit = (n, v) => n.kind === "tag" ? n.labelLower.slice(1) === v || n.labelLower.slice(1).startsWith(v + "/") : n.tagsLower.some((x) => x === v || x.startsWith(v + "/"));
  const matchTerm = (n, term) => {
    const v = term.value.replace(/^#/, "");
    let hit;
    switch (term.field) {
      case "path":
        hit = n.pathLower.includes(term.value);
        break;
      case "file":
        hit = n.labelLower.includes(term.value);
        break;
      case "tag":
        hit = tagHit(n, v);
        break;
      case "community":
        hit = n.communityLower.includes(term.value);
        break;
      case "type":
        hit = n.type === term.value;
        break;
      default:
        hit = n.labelLower.includes(term.value) || n.pathLower.includes(term.value) || n.tagsLower.some((x) => x.includes(v)) || n.communityLower.includes(term.value);
    }
    return term.neg ? !hit : hit;
  };
  const matchesAll = (n, terms) => terms.every((term) => matchTerm(n, term));
  injectStyle("graph-knowledge-css", knowledge_default);
  const app = root;
  app.innerHTML = `
<div class="og">
  <canvas class="og__canvas"></canvas>
  <div class="og__msg">Loading the graph\u2026</div>
  <div class="og__hud"></div>
  <div class="og__zoom">
    <button type="button" data-act="zin" title="Zoom in">${icons.plus}</button>
    <button type="button" data-act="zout" title="Zoom out">${icons.minus}</button>
    <button type="button" data-act="fit" title="Fit to view">${icons.fit}</button>
  </div>
  <button type="button" class="og__gear" title="Graph settings">${icons.gear}</button>
  <aside class="og__panel"></aside>
  <div class="og__card" hidden>
    <span class="og__card-dot"></span>
    <div class="og__card-t"><div class="og__card-title"></div><div class="og__card-sub"></div></div>
    <button type="button" class="og__card-open">Open note</button>
  </div>
</div>`;
  const $ = (sel, root2 = app) => root2.querySelector(sel);
  const canvas = $(".og__canvas");
  const msgEl = $(".og__msg");
  const hudEl = $(".og__hud");
  const gearEl = $(".og__gear");
  const panelEl = $(".og__panel");
  const cardEl = $(".og__card");
  let panelOpen = !compact;
  const showPanel = (open) => {
    panelOpen = open;
    panelEl.style.display = open ? "" : "none";
    gearEl.style.display = open ? "none" : "";
  };
  let data = null;
  let nodes = [];
  let links = [];
  let sim = null;
  const posCache = /* @__PURE__ */ new Map();
  let k = 1, tx = 0, ty = 0;
  let W = 0, H = 0, dpr = 1;
  let hover = null;
  let selected = null;
  let dragNode = null;
  let panning = false;
  let moved = false;
  let lastX = 0, lastY = 0, downX = 0, downY = 0;
  let lastMove = null;
  let dirty = true;
  let frameNo = 0;
  let lastFrame = 0;
  let appear = 0;
  let hoverAnim = 0;
  let fadeHover = null;
  let zoomTarget = null;
  let shownCount = 0;
  let communityRank = /* @__PURE__ */ new Map();
  let communitySize = /* @__PURE__ */ new Map();
  let kindSize = /* @__PURE__ */ new Map();
  let focus = null;
  const mix = (hex, toward, amount) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const a = p(hex), b = p(toward);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("");
  };
  const communityColor = (name) => {
    const rank = communityRank.get(name);
    if (rank == null) return THEME.node;
    const hue = BRIGHT[rank % BRIGHT.length];
    return rank < BRIGHT.length ? hue : mix(hue, BRIGHT_BASE, 0.35);
  };
  const baseColor = (n) => {
    if (n.kind === "tag") return THEME.tag;
    if (S.colorBy === "community") return communityColor(n.community);
    if (S.colorBy === "kind") return KIND_COLOR[n.type] || THEME.node;
    return THEME.node;
  };
  const isFolderGroup = (q) => /^path:wiki\/[\w-]+$/.test(q.trim());
  const colorOf = (n, groups) => {
    for (const g of groups) {
      if (!g.terms.length || g.folder && S.colorBy !== "groups") continue;
      if (matchesAll(n, g.terms)) return g.color;
    }
    return baseColor(n);
  };
  const inFocus = (n) => focus === null || (S.colorBy === "kind" ? n.type === focus : n.community === focus);
  const indexMeaning = () => {
    communitySize = /* @__PURE__ */ new Map();
    kindSize = /* @__PURE__ */ new Map();
    for (const n of data?.nodes || []) {
      if (n.communityName) communitySize.set(n.communityName, (communitySize.get(n.communityName) || 0) + 1);
      const t = (n.type || "").toLowerCase();
      if (t) kindSize.set(t, (kindSize.get(t) || 0) + 1);
    }
    communityRank = new Map([...communitySize.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name], i) => [name, i]));
  };
  const hubsOn = () => S.display.hubs;
  const radiusOf = (n) => {
    let r = n.kind === "tag" ? 2.4 : Math.min(2.2 + Math.log2(1 + n.deg) * 0.7, 8.5);
    if (hubsOn()) {
      if (n.hub) r = Math.max(r, Math.min(4.6 + Math.log2(1 + n.leaves) * 1.1, 11));
      else if (n.leafOf) r *= 0.85;
    }
    return r * S.display.nodeSize;
  };
  const resize_nodes = () => {
    for (const n of nodes) n.r = radiusOf(n);
  };
  const recolor = () => {
    const groups = S.groups.map((g) => ({ terms: parseQuery(g.query), color: g.color, folder: isFolderGroup(g.query) }));
    for (const n of nodes) {
      n.color = colorOf(n, groups);
      n.dim = !inFocus(n);
    }
    if (selected) $(".og__card-dot", cardEl).style.background = selected.color;
    dirty = true;
  };
  const updateHud = () => {
    if (!data) {
      hudEl.textContent = "";
      return;
    }
    const total = data.nodes.length;
    hudEl.textContent = shownCount === total ? `${total.toLocaleString()} ${NOUN} \xB7 ${links.length.toLocaleString()} links` : `${shownCount.toLocaleString()} of ${total.toLocaleString()} ${NOUN} \xB7 ${links.length.toLocaleString()} links`;
    if (anim.state === "playing") hudEl.textContent += " \xB7 animating forces";
    else if (anim.state === "paused") hudEl.textContent += " \xB7 animation paused";
  };
  const rebuild = () => {
    for (const n of nodes) if (n.x != null && n.y != null) posCache.set(n.id, { x: n.x, y: n.y });
    if (!data) {
      nodes = [];
      links = [];
      shownCount = 0;
      sim?.nodes([]);
      dirty = true;
      updateHud();
      return;
    }
    const byId = /* @__PURE__ */ new Map();
    const mk = (id, label, kind, path2, tags, raw) => {
      const p = posCache.get(id) || (raw && raw.x != null && raw.y != null ? { x: raw.x, y: raw.y } : void 0);
      const community = raw?.communityName || "";
      return {
        id,
        label,
        kind,
        path: path2,
        tags,
        // A wikilink node IS a note; a Graphify node points at the note it came from.
        note: kind === "tag" ? null : GRAPHIFY ? raw?.note ?? null : id,
        community,
        type: (raw?.type || "").toLowerCase(),
        labelLower: label.toLowerCase(),
        pathLower: path2.toLowerCase(),
        tagsLower: tags.map((x) => x.toLowerCase()),
        communityLower: community.toLowerCase(),
        deg: 0,
        r: 0,
        color: "",
        nb: /* @__PURE__ */ new Set(),
        dim: false,
        hub: false,
        leaves: 0,
        leafOf: null,
        raw,
        x: p?.x,
        y: p?.y
      };
    };
    let source = data.nodes;
    if (S.limit > 0 && source.length > S.limit) {
      source = [...source].sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0)).slice(0, S.limit);
    }
    for (const n of source) byId.set(n.id, mk(n.id, n.title || n.id, "note", n.path ?? (GRAPHIFY ? "" : n.id), n.tags || [], n));
    const pairs = [];
    const seen = /* @__PURE__ */ new Set();
    for (const e of data.edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b || a === b) continue;
      const key = a.id < b.id ? a.id + "\n" + b.id : b.id + "\n" + a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b, e.inferred === true]);
    }
    if (S.tags) {
      for (const n of source) {
        for (const tag of n.tags || []) {
          const id = "tag:" + tag.toLowerCase();
          let tn = byId.get(id);
          if (!tn) {
            tn = mk(id, "#" + tag, "tag", "", []);
            byId.set(id, tn);
          }
          pairs.push([byId.get(n.id), tn, false]);
        }
      }
    }
    const terms = parseQuery(S.search);
    let keep = /* @__PURE__ */ new Set();
    for (const n of byId.values()) if (!terms.length || matchesAll(n, terms)) keep.add(n);
    const kept = pairs.filter(([a, b]) => keep.has(a) && keep.has(b));
    for (const [a, b] of kept) {
      a.deg++;
      b.deg++;
      a.nb.add(b);
      b.nb.add(a);
    }
    if (!S.orphans) keep = new Set([...keep].filter((n) => n.deg > 0));
    nodes = [...keep];
    for (const n of nodes) {
      n.leaves = 0;
      n.hub = false;
      n.leafOf = null;
    }
    for (const n of nodes) {
      if (n.deg !== 1 || n.kind === "tag") continue;
      const other = n.nb.values().next().value;
      if (!GRAPHIFY || other.type === "document") {
        n.leafOf = other;
        other.leaves++;
      }
    }
    for (const n of nodes) {
      n.hub = n.leaves >= HUB_MIN_LEAVES;
      if (!n.hub) {
        for (const m of n.nb) if (m.leafOf === n) m.leafOf = null;
      }
    }
    links = kept.map(([a, b, inferred]) => ({
      source: a,
      target: b,
      inferred,
      w: 1 / Math.max(1, Math.min(a.deg, b.deg)),
      spoke: a.leafOf === b || b.leafOf === a
    }));
    resize_nodes();
    if (selected && !keep.has(selected)) select(null);
    if (hover && !keep.has(hover)) hover = null;
    recolor();
    shownCount = nodes.filter((n) => n.kind !== "tag").length;
    if (sim) {
      sim.nodes(nodes);
      sim.force("link").links(links);
      applyForces();
      sim.alpha(Math.max(sim.alpha(), 0.2));
    }
    appear = 0;
    dirty = true;
    updateHud();
  };
  const applyForces = () => {
    if (!sim) return;
    const f = S.forces;
    const hubs = hubsOn();
    sim.force("link").distance((l) => f.linkDistance * 0.32 * (hubs && l.spoke ? SPOKE_DISTANCE : 1)).strength((l) => Math.min(1, l.w * f.link * (hubs && l.spoke ? SPOKE_STRENGTH : 1)));
    sim.force("charge").strength(-f.repel * 22);
    sim.force("x").strength(f.center * 0.12);
    sim.force("y").strength(f.center * 0.12);
    const big = nodes.length > 2e3;
    sim.alphaTarget(animating() ? big ? ANIM_HEAT_BIG : ANIM_HEAT : S.display.motion ? big ? 12e-4 : 4e-3 : 0);
  };
  const animating = () => anim.state === "playing" || anim.state === "returning";
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const waveAt = (phase) => (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waveForces = (phase) => {
    const p = waveAt(phase);
    return { center: lerp(ANIM_CENTER[0], ANIM_CENTER[1], p), repel: lerp(ANIM_REPEL[0], ANIM_REPEL[1], p) };
  };
  const applyAnimatedForces = () => {
    if (!sim) return;
    sim.force("charge").strength(-S.forces.repel * 22);
    sim.force("x").strength(S.forces.center * 0.12);
    sim.force("y").strength(S.forces.center * 0.12);
    syncForceSliders();
  };
  const syncForceSliders = () => {
    for (const key of ["center", "repel"]) {
      const input = panelEl.querySelector(`[data-range="forces.${key}"]`);
      if (input && Number(input.value) !== S.forces[key]) input.value = String(S.forces[key]);
    }
  };
  const stepAnim = (dt) => {
    if (anim.state === "playing") {
      anim.phase = (anim.phase + dt * S.animate.speed / (ANIM_CYCLE_S * 1e3)) % 1;
      anim.blend = Math.min(1, anim.blend + dt / ANIM_BLEND_MS);
      const w = waveForces(anim.phase), e = smooth(anim.blend), from = anim.from || w;
      S.forces.center = lerp(from.center, w.center, e);
      S.forces.repel = lerp(from.repel, w.repel, e);
      applyAnimatedForces();
    } else if (anim.state === "returning" && anim.base && anim.from) {
      anim.blend = Math.min(1, anim.blend + dt / ANIM_BLEND_MS);
      const e = smooth(anim.blend);
      S.forces.center = lerp(anim.from.center, anim.base.center, e);
      S.forces.repel = lerp(anim.from.repel, anim.base.repel, e);
      applyAnimatedForces();
      if (anim.blend >= 1) endAnim();
    }
  };
  const setAnimState = (state) => {
    anim.state = state;
    S.animate.playing = state === "playing";
    applyForces();
    if (sim && animating() && sim.alpha() < 0.02) sim.alpha(0.02);
    renderTransport();
    updateHud();
    persist();
  };
  const playAnim = () => {
    if (anim.state === "playing") return;
    if (anim.state === "stopped" || anim.state === "returning") {
      const own = anim.base || { center: S.forces.center, repel: S.forces.repel };
      const p = Math.max(0, Math.min(1, (S.forces.center - ANIM_CENTER[0]) / (ANIM_CENTER[1] - ANIM_CENTER[0])));
      anim.base = own;
      anim.phase = Math.acos(1 - 2 * p) / (2 * Math.PI);
      anim.from = { center: S.forces.center, repel: S.forces.repel };
      anim.blend = 0;
    }
    setAnimState("playing");
  };
  const pauseAnim = () => {
    if (anim.state === "playing") setAnimState("paused");
  };
  const stopAnim = () => {
    if (anim.state === "stopped" || anim.state === "returning") return;
    anim.from = { center: S.forces.center, repel: S.forces.repel };
    anim.blend = 0;
    setAnimState("returning");
  };
  const endAnim = () => {
    if (anim.base) {
      S.forces.center = anim.base.center;
      S.forces.repel = anim.base.repel;
    }
    anim.base = null;
    anim.from = null;
    anim.blend = 0;
    applyAnimatedForces();
    setAnimState("stopped");
  };
  const abandonAnim = () => {
    if (anim.state === "stopped") return;
    anim.base = null;
    anim.from = null;
    setAnimState("stopped");
  };
  const changeAnimSpeed = (dir) => {
    const i = ANIM_SPEEDS.indexOf(S.animate.speed);
    S.animate.speed = ANIM_SPEEDS[Math.max(0, Math.min(ANIM_SPEEDS.length - 1, (i < 0 ? 2 : i) + dir))];
    renderTransport();
    persist();
  };
  const secondsPerCycle = () => Math.round(ANIM_CYCLE_S / S.animate.speed * 10) / 10;
  const renderTransport = () => {
    const el = panelEl.querySelector("[data-transport]");
    if (!el) return;
    const playing = anim.state === "playing";
    const speed = S.animate.speed;
    el.innerHTML = `
    <button type="button" class="og__tbtn${playing ? " is-active" : ""}" data-anim="${playing ? "pause" : "play"}" title="${playing ? "Pause" : "Play"}">${playing ? icons.pause : icons.play}</button>
    <button type="button" class="og__tbtn" data-anim="stop" title="Stop and return to your own forces"${anim.state === "stopped" || anim.state === "returning" ? " disabled" : ""}>${icons.stop}</button>
    <button type="button" class="og__tbtn" data-anim="slower" title="Slower"${speed <= ANIM_SPEEDS[0] ? " disabled" : ""}>${icons.minus}</button>
    <span class="og__speed" title="There and back once every ${secondsPerCycle()} seconds">${speed}\xD7</span>
    <button type="button" class="og__tbtn" data-anim="faster" title="Faster"${speed >= ANIM_SPEEDS[ANIM_SPEEDS.length - 1] ? " disabled" : ""}>${icons.plus}</button>`;
  };
  let settling = false;
  const settle = async () => {
    if (!sim || !nodes.length) return;
    settling = true;
    sim.alphaDecay(WARMUP_DECAY).velocityDecay(WARMUP_FRICTION).alpha(1);
    const total = nodes.length > BIG_GRAPH ? 300 : WARMUP_TICKS + 100;
    if (nodes.length <= BIG_GRAPH) {
      for (let i = 0; i < total; i++) sim.tick();
    } else {
      msgEl.style.display = "";
      msgEl.textContent = `Laying out ${nodes.length.toLocaleString()} ${NOUN}\u2026`;
      const started = performance.now();
      let done = 0;
      while (sim && done < total && performance.now() - started < 9e3) {
        const chunk = performance.now();
        while (done < total && performance.now() - chunk < 40) {
          sim.tick();
          done++;
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      msgEl.style.display = "none";
    }
    if (sim) {
      for (const n of nodes) {
        n.vx = 0;
        n.vy = 0;
      }
      sim.alphaDecay(COOL_DECAY).velocityDecay(CALM_FRICTION).alpha(0.01);
      applyForces();
    }
    settling = false;
    appear = 0;
    dirty = true;
  };
  const setupSim = () => {
    sim = forceSimulation([]).stop().alphaDecay(COOL_DECAY).velocityDecay(CALM_FRICTION).alphaMin(1e-3).force("link", forceLink([]).id((d) => d.id)).force("charge", forceManyBody().theta(0.9).distanceMax(900)).force("x", forceX(0)).force("y", forceY(0));
    applyForces();
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nw = rect.width, nh = rect.height, nd = window.devicePixelRatio || 1;
    if (!nw || !nh) return;
    if (nw === W && nh === H && dpr === nd) return;
    if (W && H) {
      tx += (nw - W) / 2;
      ty += (nh - H) / 2;
      if (zoomTarget) {
        zoomTarget.tx += (nw - W) / 2;
        zoomTarget.ty += (nh - H) / 2;
      }
    } else {
      tx = nw / 2;
      ty = nh / 2;
    }
    W = nw;
    H = nh;
    dpr = nd;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    dirty = true;
  };
  const fit = () => {
    resize();
    if (!nodes.length) {
      k = 1;
      tx = W / 2;
      ty = H / 2;
      dirty = true;
      return;
    }
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      if (n.x < minx) minx = n.x;
      if (n.x > maxx) maxx = n.x;
      if (n.y < miny) miny = n.y;
      if (n.y > maxy) maxy = n.y;
    }
    if (!isFinite(minx)) return;
    const pad = compact ? 30 : 60;
    const nk = Math.max(0.05, Math.min(2.5, Math.min((W - pad) / Math.max(1, maxx - minx), (H - pad) / Math.max(1, maxy - miny))));
    zoomTarget = { k: nk, tx: W / 2 - (minx + maxx) / 2 * nk, ty: H / 2 - (miny + maxy) / 2 * nk };
    if (appear === 0) {
      k = zoomTarget.k;
      tx = zoomTarget.tx;
      ty = zoomTarget.ty;
      zoomTarget = null;
    }
    dirty = true;
  };
  const zoomAt = (sx, sy, factor, immediate = false) => {
    const cur = immediate ? { k, tx, ty } : zoomTarget || { k, tx, ty };
    const wx = (sx - cur.tx) / cur.k, wy = (sy - cur.ty) / cur.k;
    const nk = Math.max(0.05, Math.min(8, cur.k * factor));
    const next = { k: nk, tx: sx - wx * nk, ty: sy - wy * nk };
    if (immediate) {
      k = next.k;
      tx = next.tx;
      ty = next.ty;
      zoomTarget = null;
    } else zoomTarget = next;
    dirty = true;
  };
  const zoomBy = (f) => zoomAt(W / 2, H / 2, f);
  const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);
  const focusNode = () => hover || selected;
  const animate = (dt) => {
    if (zoomTarget) {
      const f = 1 - Math.exp(-dt / 70);
      k += (zoomTarget.k - k) * f;
      tx += (zoomTarget.tx - tx) * f;
      ty += (zoomTarget.ty - ty) * f;
      if (Math.abs(zoomTarget.k - k) < 1e-4 && Math.abs(zoomTarget.tx - tx) < 0.2 && Math.abs(zoomTarget.ty - ty) < 0.2) {
        k = zoomTarget.k;
        tx = zoomTarget.tx;
        ty = zoomTarget.ty;
        zoomTarget = null;
      }
      dirty = true;
    }
    if (appear < 1) {
      appear = Math.min(1, appear + dt / 1200);
      dirty = true;
    }
    const want = focusNode() ? 1 : 0;
    if (hoverAnim !== want) {
      hoverAnim = approach(hoverAnim, want, dt / 260);
      dirty = true;
    }
  };
  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(k, k);
    const hov = focusNode() || (hoverAnim > 0 ? fadeHover : null);
    const dimNode = 1 - 0.7 * hoverAnim;
    const dimLink = 1 - 0.75 * hoverAnim;
    const lw = 0.8 * S.display.linkThickness / k;
    const strokePath = (pred, color, width) => {
      ctx.beginPath();
      let any = false;
      for (const l of links) {
        if (!pred(l)) continue;
        const a = l.source, b = l.target;
        if (a.x == null || b.x == null) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        any = true;
      }
      if (any) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    };
    const faint = (l) => l.source.dim || l.target.dim;
    const touches = (l) => l.source === hov || l.target === hov;
    const hubs = hubsOn();
    const isSpoke = (l) => hubs && l.spoke;
    const quiet = hov ? appear * dimLink : appear;
    if (focus !== null) {
      ctx.globalAlpha = quiet * 0.22;
      strokePath((l) => faint(l) && !(hov && touches(l)), THEME.link, lw);
    }
    ctx.globalAlpha = quiet;
    strokePath((l) => !l.inferred && !isSpoke(l) && !faint(l) && !(hov && touches(l)), THEME.link, lw);
    if (GRAPHIFY) strokePath((l) => l.inferred && !isSpoke(l) && !faint(l) && !(hov && touches(l)), THEME.inferred, lw * 1.25);
    if (hubs) {
      const byColor = /* @__PURE__ */ new Map();
      for (const l of links) {
        if (!l.spoke || faint(l) || hov && touches(l)) continue;
        const a = l.source, b = l.target;
        const hub = a.leafOf === b ? b : a;
        const list = byColor.get(hub.color) || [];
        list.push(l);
        byColor.set(hub.color, list);
      }
      ctx.globalAlpha = quiet * 0.5;
      for (const [color, list] of byColor) {
        ctx.beginPath();
        for (const l of list) {
          const a = l.source, b = l.target;
          if (a.x == null || b.x == null) continue;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lw * 1.2;
        ctx.stroke();
      }
    }
    if (hov) {
      ctx.globalAlpha = appear * hoverAnim;
      strokePath(touches, ACCENT, lw * 1.6);
    }
    const t0 = 0.9 * Math.pow(2, S.display.textFade);
    const labelAlpha = Math.max(0, Math.min(1, (k - t0) / (t0 * 0.6)));
    ctx.font = `${11 / k}px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const minX = -tx / k - 20, maxX = (W - tx) / k + 20, minY = -ty / k - 20, maxY = (H - ty) / k + 20;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      if (n.x < minX || n.x > maxX || n.y < minY || n.y > maxY) continue;
      const near = !hov || n === hov || hov.nb.has(n);
      const base = n.dim && !(hov && near) ? 0.16 : 1;
      ctx.globalAlpha = appear * base * (near ? 1 : dimNode);
      const r = Math.max(n === hov ? n.r * (1 + 0.25 * hoverAnim) : n.r, MIN_SCREEN_R / k);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      if (hubs && n.hub && n !== hov) {
        ctx.lineWidth = 1.2 / k;
        ctx.strokeStyle = HUB_RING;
        ctx.stroke();
      }
      if (n === hov) {
        ctx.globalAlpha = appear * hoverAnim;
        ctx.lineWidth = 1.5 / k;
        ctx.strokeStyle = THEME.ring;
        ctx.stroke();
      }
      const ownAlpha = hubs && n.hub ? Math.max(labelAlpha, Math.min(1, (k - t0 * 0.35) / (t0 * 0.5))) : labelAlpha;
      const la = hov && (n === hov || near && hov.nb.size <= NEIGHBOUR_LABELS_MAX) ? Math.max(ownAlpha, hoverAnim) : ownAlpha;
      if (la > 0.02 && (near || ownAlpha > 0) && base === 1) {
        ctx.globalAlpha = appear * (near ? la : la * dimNode);
        ctx.fillStyle = near ? THEME.text : THEME.textDim;
        if (hubs && n.hub) ctx.font = `600 ${11.5 / k}px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif`;
        ctx.fillText(n.label, n.x, n.y + r + 2 / k);
        if (hubs && n.hub) ctx.font = `${11 / k}px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif`;
      }
    }
    ctx.globalAlpha = 1;
  };
  const loop = (now) => {
    if (destroyed) return;
    requestAnimationFrame(loop);
    if (!sim) return;
    const elapsed = lastFrame ? now - lastFrame : 16;
    const dt = Math.min(50, elapsed);
    lastFrame = now;
    if (frameNo++ % 20 === 0) resize();
    if (settling) return;
    stepAnim(Math.min(250, elapsed));
    const active = nodes.length > 0 && (sim.alpha() > sim.alphaMin() || sim.alphaTarget() > 0 || dragNode !== null);
    const held = hover !== null && dragNode === null;
    if (active && !held) {
      sim.tick();
      dirty = true;
      updateHover();
    }
    animate(dt);
    if (dirty) {
      draw();
      dirty = false;
    }
  };
  const local2 = (cx, cy) => {
    const rect = canvas.getBoundingClientRect();
    const sx = cx - rect.left, sy = cy - rect.top;
    return { sx, sy, x: (sx - tx) / k, y: (sy - ty) / k };
  };
  const pick = (x, y, grab = GRAB_PX) => {
    let best = null, bd = Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const dx = n.x - x, dy = n.y - y, rr = Math.max(n.r, MIN_SCREEN_R / k) + grab / k;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 < bd) {
        bd = d2;
        best = n;
      }
    }
    return best;
  };
  const setCursor = (c) => {
    canvas.classList.toggle("is-grabbing", c === "grabbing");
    canvas.classList.toggle("is-pointer", c === "pointer");
  };
  const select = (n) => {
    selected = n;
    if (n) fadeHover = n;
    cardEl.hidden = !n;
    if (n) {
      $(".og__card-dot", cardEl).style.background = n.color;
      $(".og__card-title", cardEl).textContent = n.label;
      const where = n.path.replace(/^wiki\//, "").replace(/\.md$/, "") || "no note";
      $(".og__card-sub", cardEl).textContent = n.kind === "tag" ? `${n.deg} notes` : n.hub && hubsOn() ? `Hub \xB7 ${n.leaves} of its own \xB7 ${where}` : n.leafOf && hubsOn() ? `Part of ${n.leafOf.label}` : GRAPHIFY ? `${n.community || n.type || "concept"} \xB7 ${where}` : `${where.replace(/\/[^/]*$/, "") || "wiki"} \xB7 ${n.deg} links`;
      const open = $(".og__card-open", cardEl);
      open.textContent = n.kind === "tag" ? "Filter by tag" : n.note ? "Open note" : "No note";
      open.disabled = n.kind !== "tag" && !n.note;
    }
    dirty = true;
  };
  const openNode = (n) => {
    if (n.kind === "tag") {
      setSearch("tag:" + n.label.slice(1));
      select(null);
      return;
    }
    if (!n.note) return;
    host.open({ id: n.id, note: n.note, title: n.label, quote: GRAPHIFY ? n.label : "", path: n.path, raw: n.raw });
  };
  const pointers = /* @__PURE__ */ new Map();
  let pinch = null;
  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };
  const releaseDrag = () => {
    if (dragNode) {
      dragNode.fx = null;
      dragNode.fy = null;
      dragNode = null;
      applyForces();
    }
    panning = false;
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      releaseDrag();
      pinch = pinchState();
      moved = true;
      return;
    }
    if (pointers.size > 2) return;
    const p = local2(e.clientX, e.clientY);
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
    moved = false;
    const hit = pick(p.x, p.y, e.pointerType === "mouse" ? GRAB_PX : TOUCH_GRAB_PX);
    if (hit) {
      dragNode = hit;
      hit.fx = hit.x;
      hit.fy = hit.y;
      if (sim) {
        sim.alphaTarget(DRAG_ALPHA);
        if (sim.alpha() < DRAG_ALPHA) sim.alpha(DRAG_ALPHA);
      }
    } else {
      panning = true;
    }
    setCursor("grabbing");
  });
  canvas.addEventListener("pointermove", (e) => {
    const tracked = pointers.get(e.pointerId);
    if (tracked) {
      tracked.x = e.clientX;
      tracked.y = e.clientY;
    }
    if (pinch && pointers.size >= 2) {
      const now = pinchState();
      const m = local2(now.mx, now.my);
      zoomAt(m.sx, m.sy, now.dist / pinch.dist, true);
      tx += now.mx - pinch.mx;
      ty += now.my - pinch.my;
      pinch = now;
      dirty = true;
      return;
    }
    if (!tracked) {
      if (e.pointerType === "mouse") {
        lastMove = { x: e.clientX, y: e.clientY };
        updateHover();
      }
      return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > (e.pointerType === "mouse" ? 3 : 8)) moved = true;
    if (dragNode) {
      if (!moved) return;
      const p = local2(e.clientX, e.clientY);
      dragNode.fx = p.x;
      dragNode.fy = p.y;
      dirty = true;
    } else if (panning) {
      tx += dx;
      ty += dy;
      if (zoomTarget) {
        zoomTarget.tx += dx;
        zoomTarget.ty += dy;
      }
      dirty = true;
    }
  });
  const onPointerEnd = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        lastX = p.x;
        lastY = p.y;
        panning = true;
      }
      return;
    }
    const clicked = dragNode && !moved ? dragNode : null;
    const tappedEmpty = panning && !moved;
    releaseDrag();
    if (e.pointerType === "mouse") {
      lastMove = { x: e.clientX, y: e.clientY };
      updateHover();
      if (clicked && e.type === "pointerup") openNode(clicked);
    } else {
      setCursor("grab");
      if (clicked) select(selected === clicked ? null : clicked);
      else if (tappedEmpty) select(null);
    }
    dirty = true;
  };
  canvas.addEventListener("pointerup", onPointerEnd);
  canvas.addEventListener("pointercancel", onPointerEnd);
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse" || pointers.size) return;
    lastMove = null;
    if (hover) {
      hover = null;
      dirty = true;
    }
  });
  const updateHover = () => {
    if (!lastMove || dragNode || panning || pinch) return;
    const p = local2(lastMove.x, lastMove.y);
    const hit = pick(p.x, p.y);
    if (hit !== hover) {
      hover = hit;
      if (hit) fadeHover = hit;
      dirty = true;
    }
    setCursor(hit ? "pointer" : "grab");
  };
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = local2(e.clientX, e.clientY);
    zoomAt(p.sx, p.sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 15e-4)));
  }, { passive: false });
  canvas.addEventListener("dblclick", (e) => {
    const p = local2(e.clientX, e.clientY);
    if (!pick(p.x, p.y)) fit();
  });
  let gestureScale = 1;
  canvas.addEventListener("gesturestart", (e) => {
    e.preventDefault();
    gestureScale = e.scale || 1;
  });
  canvas.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    const p = local2(e.clientX ?? W / 2, e.clientY ?? H / 2);
    zoomAt(p.sx, p.sy, (e.scale || 1) / gestureScale, true);
    gestureScale = e.scale || 1;
  });
  $(".og__card-open", cardEl).addEventListener("click", () => {
    if (selected) openNode(selected);
  });
  app.querySelectorAll(".og__zoom button").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.act === "zin") zoomBy(1.25);
    else if (b.dataset.act === "zout") zoomBy(0.8);
    else fit();
  }));
  gearEl.addEventListener("click", () => showPanel(true));
  const legendRow = (key, label, color, count, hint = "") => `
<div class="og__lrow${focus === key ? " is-focus" : ""}${focus !== null && focus !== key ? " is-dim" : ""}" data-focus="${escapeHtml(key)}"${hint ? ` title="${escapeHtml(hint)}"` : ""}>
  <span class="og__lswatch" style="background:${color}"></span>
  <span class="og__llabel">${escapeHtml(label)}</span>
  <span class="og__ln">${count.toLocaleString()}</span>
</div>`;
  const renderLegend = () => {
    const legendEl = panelEl.querySelector("[data-legend-body]");
    if (!legendEl) return;
    const modes = [["community", "Community"], ["kind", "Kind"], ["groups", "Folder"]];
    let body = "";
    if (S.colorBy === "community") {
      const ranked = [...communityRank.entries()].sort((a, b) => a[1] - b[1]);
      const top = ranked.slice(0, LEGEND_ROWS);
      const rest = ranked.length - top.length;
      const restNodes = ranked.slice(LEGEND_ROWS).reduce((sum, [name]) => sum + (communitySize.get(name) || 0), 0);
      body = top.map(([name]) => legendRow(name, name, communityColor(name), communitySize.get(name) || 0)).join("") + (rest > 0 ? `<div class="og__lrow is-static"><span class="og__lswatch" style="background:${mix(BRIGHT[0], BRIGHT_BASE, 0.35)}"></span><span class="og__llabel">${rest} smaller communities</span><span class="og__ln">${restNodes.toLocaleString()}</span></div>` : "") + `<div class="og__lhint">A community is a group of ideas that Graphify found belong together. Click one to see it alone; search <b>community:name</b> for the smaller ones.</div>`;
    } else if (S.colorBy === "kind") {
      body = Object.keys(KIND_LABEL).filter((kind) => kindSize.get(kind)).map((kind) => legendRow(kind, KIND_LABEL[kind], KIND_COLOR[kind], kindSize.get(kind) || 0, KIND_HINT[kind])).join("") + `<div class="og__lhint">Notes are your files. Everything else was found inside one of them.</div>`;
    } else {
      body = `<div class="og__lhint">Colours come from the Groups panel, by the folder of the note each node came from.</div>`;
    }
    legendEl.innerHTML = `
    <div>
      <div class="og__lmodes">${modes.map(([m, label]) => `<button type="button" class="og__lmode${S.colorBy === m ? " is-active" : ""}" data-mode="${m}">${label}</button>`).join("")}</div>
      ${body}
      <div class="og__lkey"><span class="og__lline"></span>stated in a note</div>
      <div class="og__lkey"><span class="og__lline og__lline--inferred"></span>inferred by Graphify</div>
      ${hubsOn() ? '<div class="og__lkey"><span class="og__lhub"></span>a note, with the ideas found in it drawn in its colour</div>' : ""}
    </div>`;
  };
  panelEl.addEventListener("click", (e) => {
    const t = e.target.closest("[data-mode],[data-focus]");
    if (!t) return;
    if (t.dataset.mode) {
      S.colorBy = t.dataset.mode;
      focus = null;
      if (S.colorBy === "groups" && !S.groups.length) {
        S.groups.push(...SRC.groups.map((g) => ({ ...g })));
        renderGroups();
      }
    } else if (t.dataset.focus != null) {
      focus = focus === t.dataset.focus ? null : t.dataset.focus;
    }
    persist();
    recolor();
    renderLegend();
  });
  let rebuildTimer = null;
  const scheduleRebuild = () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 150);
  };
  const setSearch = (value) => {
    S.search = value;
    persist();
    const input = panelEl.querySelector('[data-bind="search"]');
    if (input) input.value = value;
    syncClear();
    scheduleRebuild();
  };
  const syncClear = () => {
    const clear = panelEl.querySelector(".og__clear");
    if (clear) clear.style.display = S.search ? "" : "none";
  };
  const section = (id, title, body, tools = "") => `
<section class="og__sec${S.open[id] ? "" : " is-closed"}" data-sec="${id}">
  <header class="og__sec-h">
    <button type="button" class="og__sec-t" data-toggle="${id}">${S.open[id] ? icons.chevronDown : icons.chevronRight}${title}</button>
    ${tools}
  </header>
  <div class="og__sec-b">${body}</div>
</section>`;
  const toggleRow = (label, key, on) => `
<label class="og__row"><span>${label}</span><span class="og__switch"><input type="checkbox" data-switch="${key}"${on ? " checked" : ""}><span></span></span></label>`;
  const sliderRow = (label, key, value, min, max, step) => `
<label class="og__slider"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  const limitRow = () => {
    const total = data?.nodes.length || 0;
    if (total <= LIMIT_OPTIONS[0]) return "";
    const options = LIMIT_OPTIONS.filter((n) => n < total).map((n) => `<option value="${n}"${S.limit === n ? " selected" : ""}>Top ${n.toLocaleString()}</option>`).join("");
    return `<label class="og__row"><span>Show</span><select class="og__select" data-select="limit">${options}<option value="0"${S.limit === 0 || S.limit >= total ? " selected" : ""}>All ${total.toLocaleString()}</option></select></label>`;
  };
  const groupRows = () => S.groups.map((g, i) => `
<div class="og__group" data-group="${i}">
  <input type="text" class="og__group-q" data-group-q="${i}" value="${escapeHtml(g.query)}" placeholder="${GRAPHIFY ? "path:concepts, community:name, type:paper \u2026" : "path:concepts, tag:name \u2026"}" spellcheck="false" autocapitalize="off" autocorrect="off">
  <label class="og__swatch" style="background:${escapeHtml(g.color)}" title="Colour"><input type="color" data-group-c="${i}" value="${escapeHtml(g.color)}"></label>
  <button type="button" class="og__x" data-group-x="${i}" title="Remove group">${icons.close}</button>
</div>`).join("") + `<button type="button" class="og__new" data-act="new-group">New group</button>`;
  const renderPanel = () => {
    panelEl.innerHTML = section(
      "filters",
      "Filters",
      `
      <label class="og__search">${icons.search}
        <input type="text" data-bind="search" value="${escapeHtml(S.search)}" placeholder="Search files\u2026" spellcheck="false" autocapitalize="off" autocorrect="off">
        <button type="button" class="og__clear" title="Clear">${icons.close}</button>
      </label>
      <div class="og__hint">path:folder &nbsp; file:name &nbsp; ${GRAPHIFY ? "community:name &nbsp; type:concept" : "tag:name"} &nbsp; -not &nbsp; "exact phrase"</div>
      ${GRAPHIFY ? "" : toggleRow("Tags", "tags", S.tags)}
      ${toggleRow("Orphans", "orphans", S.orphans)}
      ${limitRow()}`,
      `<span class="og__sec-tools">
        <button type="button" data-act="reset" title="Restore default settings">${icons.reset}</button>
        <button type="button" data-act="close" title="Close">${icons.close}</button>
      </span>`
    ) + (GRAPHIFY && data?.nodes.length ? section("legend", "Colour by", "<div data-legend-body></div>") : "") + section("groups", "Groups", `<div data-groups style="display:flex;flex-direction:column;gap:10px">${groupRows()}</div>`) + section(
      "display",
      "Display",
      sliderRow("Node size", "display.nodeSize", S.display.nodeSize, 0.1, 5, 0.1) + sliderRow("Link thickness", "display.linkThickness", S.display.linkThickness, 0.1, 5, 0.1) + sliderRow("Text fade threshold", "display.textFade", S.display.textFade, -3, 3, 0.1) + toggleRow("Show hubs", "hubs", S.display.hubs) + toggleRow("Gentle motion", "motion", S.display.motion)
    ) + section(
      "forces",
      "Forces",
      `<div class="og__row"><span>Animate</span><div class="og__transport" role="group" aria-label="Force animation" data-transport></div></div>
      <div class="og__hint">Centre force runs from 40% to the maximum while repel runs from 100% down to 20%, then back.</div>` + sliderRow("Center force", "forces.center", S.forces.center, 0, 1, 0.01) + sliderRow("Repel force", "forces.repel", S.forces.repel, 0, 20, 0.1) + sliderRow("Link force", "forces.link", S.forces.link, 0, 1, 0.01) + sliderRow("Link distance", "forces.linkDistance", S.forces.linkDistance, 30, 500, 1)
    );
    syncClear();
    renderTransport();
    renderLegend();
  };
  const renderGroups = () => {
    const el = panelEl.querySelector("[data-groups]");
    if (el) el.innerHTML = groupRows();
  };
  panelEl.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle],[data-act],[data-anim],[data-group-x],.og__clear");
    if (!t) return;
    if (t.dataset.anim) {
      const act = t.dataset.anim;
      if (act === "play") playAnim();
      else if (act === "pause") pauseAnim();
      else if (act === "stop") stopAnim();
      else changeAnimSpeed(act === "faster" ? 1 : -1);
    } else if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      S.open[id] = !S.open[id];
      const sec = panelEl.querySelector(`[data-sec="${id}"]`);
      sec.classList.toggle("is-closed", !S.open[id]);
      t.innerHTML = (S.open[id] ? icons.chevronDown : icons.chevronRight) + escapeHtml(t.textContent || "");
      persist();
    } else if (t.dataset.act === "close") {
      showPanel(false);
    } else if (t.dataset.act === "reset") {
      anim.state = "stopped";
      anim.base = null;
      anim.from = null;
      Object.assign(S, defaults(), { open: S.open });
      focus = null;
      renderPanel();
      rebuild();
      renderLegend();
      applyForces();
      sim?.alpha(Math.max(sim.alpha(), 0.3));
      persist();
      if (S.animate.playing) playAnim();
    } else if (t.dataset.act === "new-group") {
      S.groups.push({ query: "", color: NEW_GROUP_COLORS[S.groups.length % NEW_GROUP_COLORS.length] });
      renderGroups();
      persist();
      panelEl.querySelector(`[data-group-q="${S.groups.length - 1}"]`)?.focus();
    } else if (t.dataset.groupX != null) {
      S.groups.splice(Number(t.dataset.groupX), 1);
      renderGroups();
      recolor();
      persist();
    } else if (t.classList.contains("og__clear")) {
      setSearch("");
    }
  });
  panelEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.bind === "search") {
      S.search = t.value;
      syncClear();
      scheduleRebuild();
      persist();
      return;
    }
    if (t.dataset.groupQ != null) {
      S.groups[Number(t.dataset.groupQ)].query = t.value;
      recolor();
      persist();
      return;
    }
    if (t.dataset.groupC != null) {
      S.groups[Number(t.dataset.groupC)].color = t.value;
      t.parentElement.style.background = t.value;
      recolor();
      persist();
      return;
    }
    if (t.dataset.range) {
      const [a, b] = t.dataset.range.split(".");
      if (a === "forces" && (b === "center" || b === "repel")) abandonAnim();
      S[a][b] = Number(t.value);
      if (a === "forces") {
        applyForces();
        sim?.alpha(Math.max(sim.alpha(), 0.3));
      } else if (b === "nodeSize") resize_nodes();
      dirty = true;
      persist();
    }
  });
  panelEl.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.select === "limit") {
      S.limit = Number(t.value) || 0;
      posCache.clear();
      rebuild();
      persist();
      void settle().then(fit);
      return;
    }
    if (!t.dataset.switch) return;
    if (t.dataset.switch === "tags") {
      S.tags = t.checked;
      scheduleRebuild();
    } else if (t.dataset.switch === "orphans") {
      S.orphans = t.checked;
      scheduleRebuild();
    } else if (t.dataset.switch === "motion") {
      S.display.motion = t.checked;
      applyForces();
    } else if (t.dataset.switch === "hubs") {
      S.display.hubs = t.checked;
      resize_nodes();
      applyForces();
      renderLegend();
      if (sim) sim.alpha(Math.max(sim.alpha(), 0.3));
      dirty = true;
    }
    persist();
  });
  const start = async () => {
    setupSim();
    renderPanel();
    showPanel(panelOpen);
    resize();
    resizeObserver.observe(canvas);
    requestAnimationFrame(loop);
    try {
      if (opts.initialData) dataCache.set(SRC.id, opts.initialData);
      renderSource();
      await showSource();
      host.notify?.("ready", { nodes: data?.nodes.length || 0, links: links.length });
    } catch (err) {
      fail(err);
    }
  };
  const fail = (err) => {
    msgEl.style.display = "";
    msgEl.textContent = "Could not load the graph.";
    host.notify?.("failed", { message: err instanceof Error ? err.message : "unknown" });
  };
  const dataCache = /* @__PURE__ */ new Map();
  let switching = false;
  const sourceEl = app.appendChild(Object.assign(document.createElement("div"), { className: "og__source" }));
  sourceEl.setAttribute("role", "group");
  sourceEl.setAttribute("aria-label", "Graph");
  const renderSource = () => {
    sourceEl.hidden = SOURCES.length < 2;
    sourceEl.innerHTML = SOURCES.map((src) => `
    <button type="button" class="og__srcb${src === SRC ? " is-active" : ""}" data-source="${escapeHtml(src.id)}"${src.title ? ` title="${escapeHtml(src.title)}"` : ""}${switching ? " disabled" : ""}>${escapeHtml(src.label)}</button>`).join("");
  };
  const showSource = async () => {
    const src = SRC;
    let g = dataCache.get(src.id);
    if (!g) {
      msgEl.style.display = "";
      msgEl.textContent = src.loadingText || "Reading the graph\u2026";
      g = await host.request("graph", { source: src.id });
      if (!g || !Array.isArray(g.nodes)) throw new Error("no graph data");
      dataCache.set(src.id, g);
    }
    if (destroyed || src !== SRC) return;
    data = g;
    msgEl.style.display = data.nodes.length ? "none" : "";
    if (!data.nodes.length) msgEl.textContent = src.emptyText || "There is nothing to draw yet.";
    indexMeaning();
    renderPanel();
    renderLegend();
    applyForces();
    rebuild();
    resize();
    await settle();
    fit();
    if (S.animate.playing && anim.state !== "playing") playAnim();
  };
  const switchSource = async (next) => {
    if (!next || next === SRC || switching) return;
    switching = true;
    if (anim.state !== "stopped") {
      if (anim.base) {
        S.forces.center = anim.base.center;
        S.forces.repel = anim.base.repel;
      }
      persist();
      anim.state = "stopped";
      anim.base = null;
      anim.from = null;
    } else persist();
    useSource(next);
    host.saveSetting(SOURCE_KEY, next.id);
    Object.assign(S, loadSettings());
    focus = null;
    select(null);
    hover = null;
    fadeHover = null;
    dragNode = null;
    posCache.clear();
    data = null;
    rebuild();
    renderSource();
    try {
      await showSource();
    } catch (err) {
      fail(err);
    }
    switching = false;
    renderSource();
  };
  sourceEl.addEventListener("click", (e) => {
    const t = e.target.closest("[data-source]");
    if (t) void switchSource(sourceById(t.dataset.source));
  });
  (host.debug ? window : {}).__kg2d = {
    sim: () => sim,
    nodes: () => nodes,
    links: () => links,
    draw,
    fit,
    view: () => ({ k, tx, ty, W, H }),
    hover: () => hover,
    selected: () => selected,
    settings: () => S,
    anim: () => ({ ...anim }),
    source: () => SRC.id,
    switchSource: (id) => switchSource(sourceById(id)),
    // Advances the animation and the layout by hand, for a hidden page whose frames are paused.
    step: (ms) => {
      stepAnim(ms);
      sim?.tick();
      dirty = true;
    }
  };
  const resizeObserver = new ResizeObserver(() => resize());
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    resizeObserver.disconnect();
    sim?.stop();
    sim = null;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    app.innerHTML = "";
    if (window.__kg2d?.page === page) delete window.__kg2d;
  };
  const page = { destroy };
  if (host.debug) window.__kg2d.page = page;
  start();
  return page;
}

// src/force3d/main.ts
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// src/force3d/force3d.css
var force3d_default = `/* Everything is scoped to the page root, so a graph can live inside any app's
   layout as well as fill a whole page or web view. */
.g3 { --accent: #8b7cf6; color-scheme: dark;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.g3, .g3 *, .g3 *::before, .g3 *::after { box-sizing: border-box; }
.g3 button { font: inherit; color: inherit; }

.g3 { position: absolute; inset: 0; background: #101216; color: #dcdcdc; font-size: 13px; }
.g3__canvas { position: absolute; inset: 0; touch-action: none; z-index: 0; }
/* Controls sit above the floating name labels. */
.g3__top, .g3__dock, .g3__gear, .g3__panel, .g3__card, .g3__hud, .g3__msg { z-index: 2; }
.g3__msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #8a8f99; font-size: 14px; pointer-events: none; }
.g3__msg[hidden] { display: none; }
.g3__hud { position: absolute; left: 12px; bottom: 12px; font-size: 11px; color: #8a8f99; pointer-events: none; }

/* Top left: which graph, and the local graph's controls. */
.g3__top { position: absolute; top: 12px; left: 12px; right: 60px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; pointer-events: none; }
.g3__top > * { pointer-events: auto; }
.g3__seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: rgba(30, 32, 38, .92); border: 1px solid #33363f; }
.g3__segb { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: #a3a9b5; cursor: pointer; font-size: 12px; }
.g3__segb:hover:not(:disabled) { color: #fff; }
.g3__segb.is-active { background: #3a3d47; color: #fff; }
.g3__segb:disabled { opacity: .5; cursor: default; }
.g3__seg--small { background: #1b1c20; }
.g3__seg--small .g3__segb { height: 24px; padding: 0 9px; }
.g3__local { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 4px 0 12px; border-radius: 17px;
  background: rgba(30, 32, 38, .92); border: 1px solid color-mix(in srgb, var(--accent) 55%, #33363f); max-width: 100%; }
.g3__local-t { font-size: 12px; color: #b9bec8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.g3__local-t b { color: #fff; font-weight: 600; }
.g3__depth { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: #fff; white-space: nowrap; font-variant-numeric: tabular-nums; }

.g3__chip { height: 28px; padding: 0 12px; border-radius: 14px; border: 1px solid #3a3d47; background: transparent; color: #d4d7de; cursor: pointer; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
.g3__chip:hover { background: #2c2f37; color: #fff; }

/* Bottom right: orbit transport and fit, like the 3D Semantic Graph. */
.g3__dock { position: absolute; right: 12px; bottom: 10px; display: flex; align-items: center; gap: 6px; }
.g3__transport { display: inline-flex; align-items: center; gap: 2px; height: 34px; padding: 0 4px; border: 1px solid #33363f; border-radius: 17px; background: rgba(30, 32, 38, .92); }
.g3__tbtn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 14px; background: transparent; color: #b8bcc6; cursor: pointer; padding: 0; }
.g3__tbtn svg { width: 15px; height: 15px; }
.g3__tbtn:hover:not(:disabled) { background: #33363f; color: #fff; }
.g3__tbtn.is-active { background: color-mix(in srgb, var(--accent) 28%, transparent); color: #fff; }
.g3__tbtn:disabled { opacity: .35; cursor: default; }
.g3__speed { min-width: 40px; text-align: center; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; color: #fff; }
.g3__round, .g3__gear { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 17px;
  border: 1px solid #33363f; background: rgba(30, 32, 38, .92); color: #b8bcc6; cursor: pointer; padding: 0; }
.g3__round:hover, .g3__gear:hover { background: #33363f; color: #fff; }
.g3__gear { position: absolute; top: 12px; right: 12px; border-radius: 8px; }

/* Settings panel: Obsidian's, floating top right. */
.g3__panel {
  position: absolute; top: 12px; right: 12px; width: min(300px, calc(100vw - 24px)); max-height: calc(100% - 70px); overflow: auto;
  border-radius: 10px; border: 1px solid #33363f; background: rgba(34, 36, 42, .96);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
}
.g3__sec { border-bottom: 1px solid #33363f; }
.g3__sec:last-child { border-bottom: 0; }
.g3__sec-h { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 10px 8px; }
.g3__sec-t { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; font-size: 15px; font-weight: 600; cursor: pointer; padding: 0; }
.g3__sec-tools { display: inline-flex; gap: 2px; }
.g3__sec-tools button, .g3__x { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 6px;
  background: transparent; color: #a0a4ad; cursor: pointer; padding: 0; flex-shrink: 0; }
.g3__sec-tools button:hover, .g3__x:hover { background: #3a3d47; color: #fff; }
.g3__sec-b { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 10px; }
.g3__sec.is-closed .g3__sec-b { display: none; }
.g3__search { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 8px; background: #1b1c20; color: #8a8f99; }
.g3__search input, .g3__group-q { flex: 1; min-width: 0; border: 0; background: transparent; color: #e6e6e6; font: inherit; outline: none; -webkit-user-select: text; user-select: text; }
.g3__hint { font-size: 11px; color: #7a7f89; line-height: 15px; }
.g3__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; }
.g3__switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
.g3__switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.g3__switch span { position: absolute; inset: 0; border-radius: 10px; background: #4a4d55; transition: background .18s ease; pointer-events: none; }
.g3__switch span::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .18s ease; }
.g3__switch input:checked + span { background: var(--accent); }
.g3__switch input:checked + span::after { transform: translateX(16px); }
.g3__slider { display: flex; flex-direction: column; gap: 4px; }
.g3__slider input[type=range] { width: 100%; accent-color: var(--accent); margin: 0; }
.g3__select { height: 28px; max-width: 150px; padding: 0 8px; border-radius: 8px; border: 1px solid #33363f; background: #1b1c20; color: #e6e6e6; font: inherit; }
.g3__groups { display: flex; flex-direction: column; gap: 10px; }
.g3__group { display: flex; align-items: center; gap: 8px; }
.g3__group-q { height: 32px; padding: 0 10px; border-radius: 8px; background: #1b1c20; }
.g3__group-q:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent); }
.g3__swatch { position: relative; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35); }
.g3__swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; padding: 0; border: 0; }
.g3__new { height: 32px; border-radius: 8px; border: 0; background: #1b1c20; cursor: pointer; }
.g3__new:hover { background: #33363f; }

/* The selected note. */
.g3__card {
  position: absolute; left: 12px; right: 12px; bottom: 56px; margin: 0 auto; max-width: 520px;
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px;
  border: 1px solid #33363f; background: rgba(34, 36, 42, .97); box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
}
.g3__card[hidden] { display: none; }
.g3__card-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.g3__card-t { flex: 1; min-width: 0; }
.g3__card-title { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g3__card-sub { font-size: 11px; color: #9a9ea8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g3__open { height: 30px; padding: 0 14px; border-radius: 8px; border: 0; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.g3__open:disabled { background: #3a3d47; color: #9a9ea8; cursor: default; }

/* Hover tooltip and the floating name labels. */
.g3__tip { padding: 3px 8px; border-radius: 6px; background: #1f2230; color: #e4e7ef; font-size: 12px; border: 1px solid #343a4f; font-family: -apple-system, "SF Pro Text", Helvetica, sans-serif; }
.g3__tip small { display: block; color: #8f96a8; font-size: 10.5px; }
.g3__label { padding: 1px 6px; border-radius: 5px; background: rgba(16, 18, 22, .72); color: #e6e8ee; font-size: 11px; white-space: nowrap;
  font-family: -apple-system, "SF Pro Text", Helvetica, sans-serif; pointer-events: none; transform: translateY(-4px); }
.g3__label.is-focus { color: #fff; font-weight: 600; font-size: 12px; border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent); }

/* Phone width. */
.g3.is-compact .g3__card { flex-wrap: wrap; }
.g3.is-compact .g3__card-t { flex-basis: calc(100% - 24px); }
.g3.is-compact .g3__card .g3__chip, .g3.is-compact .g3__open { flex: 1; }
.g3.is-compact .g3__hud { bottom: 54px; }
`;

// src/force3d/main.ts
function mount3D(root, host, opts) {
  const compact = host.compact;
  let destroyed = false;
  const SOURCES = opts.sources;
  const sourceById = (id) => SOURCES.find((x) => x.id === id);
  const SETTINGS_KEY = opts.settingsKey;
  const SETTINGS_VERSION = 1;
  const LIMIT_OPTIONS = [400, 800, 1500, 3e3];
  const SPEED_STEPS2 = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
  const DEPTH_MAX = 4;
  const LABELS_MAX = compact ? 16 : 40;
  const BG = "#101216";
  const NODE_GREY = "#9aa1ad";
  const DIM_NODE = "#2b303b";
  const LINK = "rgba(160,170,196,0.55)";
  const LINK_DIM = "rgba(120,128,150,0.12)";
  const LINK_INFERRED = "rgba(255,214,120,0.55)";
  const ACCENT = host.accent || "#8b7cf6";
  const NEW_GROUP_COLORS = ["#e05252", "#e0b152", "#b1e052", "#52e052", "#52e0b1", "#52b1e0", "#5a5ae2", "#b152e0", "#e052b1", "#f28c3a"];
  const BRIGHT = ["#e05252", "#e0b152", "#52e052", "#52e0b1", "#52b1e0", "#5a5ae2", "#b152e0", "#e052b1", "#f28c3a", "#a8e04a", "#4fb3e8", "#e84fb0", "#ffe066", "#6f8bff"];
  const defaults = () => ({
    v: SETTINGS_VERSION,
    source: SOURCES[0].id,
    colorBy: "groups",
    search: "",
    orphans: true,
    limit: compact ? 600 : 1500,
    groups: SOURCES[0].groups.map((g) => ({ ...g })),
    display: { nodeSize: 1, linkThickness: 0, linkOpacity: 0.5, particleSize: 2, particleCount: 3, labels: true },
    forces: { center: 0.3, repel: 10, linkDistance: 40 },
    orbit: true,
    speed: 1,
    depth: 1,
    open: { filters: true, groups: !compact, display: false, forces: false }
  });
  const loadSettings = () => {
    const d = defaults();
    try {
      const raw = host.loadSetting(SETTINGS_KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      return {
        ...d,
        ...s,
        v: SETTINGS_VERSION,
        search: typeof s.search === "string" ? s.search : "",
        source: sourceById(s.source) ? s.source : SOURCES[0].id,
        colorBy: s.colorBy === "community" ? "community" : "groups",
        limit: typeof s.limit === "number" && s.limit >= 0 ? s.limit : d.limit,
        speed: SPEED_STEPS2.includes(s.speed) ? s.speed : d.speed,
        depth: Number.isInteger(s.depth) ? Math.max(1, Math.min(DEPTH_MAX, s.depth)) : d.depth,
        display: { ...d.display, ...s.display || {} },
        forces: { ...d.forces, ...s.forces || {} },
        open: { ...d.open, ...s.open || {} },
        groups: Array.isArray(s.groups) ? s.groups.filter((g) => g && typeof g.query === "string" && typeof g.color === "string") : d.groups
      };
    } catch {
      return d;
    }
  };
  const S = loadSettings();
  const persist = () => host.saveSetting(SETTINGS_KEY, S);
  const parseQuery = (q) => {
    const terms = [];
    const re = /(-)?(?:(path|file|tag|community|type):)?(?:"([^"]*)"|(\S+))/g;
    let m;
    while (m = re.exec(q)) {
      const value = (m[3] ?? m[4] ?? "").toLowerCase();
      if (value) terms.push({ neg: !!m[1], field: m[2] || "any", value });
    }
    return terms;
  };
  const matchTerm = (n, term) => {
    const v = term.value.replace(/^#/, "");
    let hit;
    switch (term.field) {
      case "path":
        hit = n.pathLower.includes(term.value);
        break;
      case "file":
        hit = n.labelLower.includes(term.value);
        break;
      case "tag":
        hit = n.tagsLower.some((x) => x === v || x.startsWith(v + "/"));
        break;
      case "community":
        hit = n.communityLower.includes(term.value);
        break;
      case "type":
        hit = n.type === term.value;
        break;
      default:
        hit = n.labelLower.includes(term.value) || n.pathLower.includes(term.value) || n.tagsLower.some((x) => x.includes(v)) || n.communityLower.includes(term.value);
    }
    return term.neg ? !hit : hit;
  };
  const matchesAll = (n, terms) => terms.every((t) => matchTerm(n, t));
  injectStyle("graph-force3d-css", force3d_default);
  const app = root;
  app.innerHTML = `
<div class="g3${compact ? " is-compact" : ""}">
  <div class="g3__canvas"></div>
  <div class="g3__msg">Loading the 3D graph\u2026</div>
  <div class="g3__hud"></div>
  <div class="g3__top"></div>
  <div class="g3__dock"></div>
  <button type="button" class="g3__gear" title="Graph settings">${icons.gear}</button>
  <aside class="g3__panel"></aside>
  <div class="g3__card" hidden></div>
</div>`;
  const $ = (sel) => app.querySelector(sel);
  const canvasEl = $(".g3__canvas");
  const msgEl = $(".g3__msg");
  const hudEl = $(".g3__hud");
  const topEl = $(".g3__top");
  const dockEl = $(".g3__dock");
  const gearEl = $(".g3__gear");
  const panelEl = $(".g3__panel");
  const cardEl = $(".g3__card");
  let panelOpen = !compact;
  const showPanel = (open) => {
    panelOpen = open;
    panelEl.style.display = open ? "" : "none";
    gearEl.style.display = open ? "none" : "";
  };
  const cache = /* @__PURE__ */ new Map();
  let data = null;
  let fg = null;
  let resizeObserver = null;
  let loading = false;
  const nodeCache = /* @__PURE__ */ new Map();
  let shown = [];
  let shownLinks = [];
  const neighbours = /* @__PURE__ */ new Map();
  const linksOf = /* @__PURE__ */ new Map();
  let hoverNode = null;
  let hoverLink = null;
  let selected = null;
  let localRoot = null;
  const litNodes = /* @__PURE__ */ new Set();
  const litLinks = /* @__PURE__ */ new Set();
  let labelled = [];
  let communityRank = /* @__PURE__ */ new Map();
  let viewerMoved = false;
  let firstFitTimer = null;
  let pointerKind = host.platform === "ios" ? "touch" : "mouse";
  const hovering = () => pointerKind === "mouse" || pointerKind === "pen";
  const ends = (l) => [l.source, l.target];
  const currentSource = () => sourceById(S.source) || SOURCES[0];
  const isGraphify = () => !!currentSource().graphify;
  const noun = () => currentSource().noun || (isGraphify() ? "nodes" : "notes");
  const isFolderGroup = (q) => /^path:wiki\/[\w-]+$/.test(q.trim());
  const communityColor = (name) => {
    const rank = communityRank.get(name);
    if (rank == null) return NODE_GREY;
    return BRIGHT[rank % BRIGHT.length];
  };
  let compiledGroups = [];
  const compileGroups = () => {
    compiledGroups = S.groups.map((g) => ({ terms: parseQuery(g.query), color: g.color, folder: isFolderGroup(g.query) }));
  };
  const baseColor = (n) => {
    const community = isGraphify() && S.colorBy === "community";
    for (const g of compiledGroups) {
      if (!g.terms.length || community && g.folder) continue;
      if (matchesAll(n, g.terms)) return g.color;
    }
    return community ? communityColor(n.community) : NODE_GREY;
  };
  const focusNode = () => hoverNode || selected;
  const nodeColor = (n) => {
    if (!litNodes.size) return n.color;
    if (n === focusNode()) return "#ffffff";
    return litNodes.has(n) ? n.color : DIM_NODE;
  };
  const nodeRadius = (n) => (1.8 + Math.log2(1 + n.deg) * 0.9) * S.display.nodeSize;
  const sphereGeom = new THREE.SphereGeometry(1, compact ? 14 : 24, compact ? 10 : 18);
  const nodeSphere = (n) => {
    const mat = new THREE.MeshPhongMaterial({ color: nodeColor(n), shininess: 70, specular: new THREE.Color(5592405), transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(sphereGeom, mat);
    const r = nodeRadius(n);
    mesh.scale.set(r, r, r);
    return mesh;
  };
  const rotateSpeedFor = (s) => s / 2;
  const secondsPerTurn = () => Math.round(120 / S.speed * 10) / 10;
  const gravity = () => {
    let nodes = [];
    const force = (alpha) => {
      const k = S.forces.center * 0.08 * alpha;
      for (const n of nodes) {
        n.vx -= (n.x || 0) * k;
        n.vy -= (n.y || 0) * k;
        n.vz -= (n.z || 0) * k;
      }
    };
    force.initialize = (ns) => {
      nodes = ns;
    };
    return force;
  };
  const applyForces = () => {
    if (!fg) return;
    fg.d3Force("charge").strength(-S.forces.repel * 6);
    fg.d3Force("link").distance(S.forces.linkDistance);
  };
  const ensureGraph = () => {
    if (fg) return;
    const labels = new CSS2DRenderer();
    labels.domElement.style.pointerEvents = "none";
    fg = new ForceGraph3D(canvasEl, { controlType: "orbit", extraRenderers: [labels] }).backgroundColor(BG).showNavInfo(false).nodeId("id").nodeLabel((n) => !hovering() ? "" : `<div class="g3__tip">${escapeHtml(n.label)}${n.path ? `<small>${escapeHtml(n.path.replace(/^wiki\//, "").replace(/\/[^/]*$/, ""))}</small>` : ""}</div>`).nodeThreeObject((n) => nodeSphere(n)).linkColor((l) => litLinks.has(l) ? ACCENT : litNodes.size ? LINK_DIM : l.inferred ? LINK_INFERRED : LINK).linkWidth((l) => litLinks.has(l) ? Math.max(1.2, S.display.linkThickness * 1.5) : S.display.linkThickness).linkOpacity(S.display.linkOpacity).linkDirectionalParticles((l) => litLinks.has(l) ? S.display.particleCount : 0).linkDirectionalParticleWidth(S.display.particleSize).linkDirectionalParticleSpeed(6e-3).linkDirectionalParticleColor(() => ACCENT).d3AlphaDecay(0.015).d3VelocityDecay(0.55).warmupTicks(0).cooldownTime(2e4).onNodeHover((n) => {
      if (!hovering()) n = null;
      if (n === hoverNode) return;
      hoverNode = n;
      hoverLink = null;
      canvasEl.style.cursor = n ? "pointer" : "";
      light();
    }).onLinkHover((l) => {
      if (!hovering()) l = null;
      if (hoverNode || l === hoverLink) return;
      hoverLink = l;
      light();
    }).onNodeClick((n) => {
      select(n);
      if (hovering()) openNode(n);
    }).onBackgroundClick(() => select(null));
    for (const type of ["pointerdown", "pointermove"]) {
      canvasEl.addEventListener(type, (e) => {
        pointerKind = e.pointerType || "mouse";
      }, { capture: true, passive: true });
    }
    canvasEl.addEventListener("pointerdown", () => {
      viewerMoved = true;
    }, { capture: true, passive: true });
    canvasEl.addEventListener("wheel", () => {
      viewerMoved = true;
    }, { capture: true, passive: true });
    fg.d3Force("gravity", gravity());
    applyForces();
    const key = new THREE.DirectionalLight(16777215, 2.2);
    key.position.set(1, 1.4, 1.2);
    const fill = new THREE.DirectionalLight(14673919, 0.8);
    fill.position.set(-1.4, -0.6, -1);
    fg.lights([new THREE.AmbientLight(16777215, 1.1), key, fill, new THREE.HemisphereLight(16777215, 3355460, 0.5)]);
    const controls = fg.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = S.orbit;
    controls.autoRotateSpeed = rotateSpeedFor(S.speed);
    resizeObserver = new ResizeObserver(() => fitSize());
    resizeObserver.observe(canvasEl);
    fitSize();
  };
  const fitView = (ms) => {
    if (!fg) return;
    const linked = shown.some((n) => n.deg > 0);
    fg.zoomToFit(ms, compact ? 24 : 60, (n) => !linked || n.deg > 0);
  };
  const fitSize = () => {
    if (fg) fg.width(canvasEl.clientWidth).height(canvasEl.clientHeight);
  };
  const light = () => {
    litNodes.clear();
    litLinks.clear();
    const f = focusNode();
    if (f) {
      litNodes.add(f);
      for (const m of neighbours.get(f) || []) litNodes.add(m);
      for (const l of linksOf.get(f) || []) litLinks.add(l);
    } else if (hoverLink) {
      litLinks.add(hoverLink);
      for (const n of ends(hoverLink)) if (typeof n === "object") litNodes.add(n);
    }
    repaint();
    labelLit();
  };
  const repaint = () => {
    if (!fg) return;
    for (const n of shown) {
      const mat = n.__threeObj?.material;
      if (!mat) continue;
      mat.color.set(nodeColor(n));
      mat.opacity = litNodes.size && !litNodes.has(n) ? 0.35 : 1;
    }
    fg.linkColor(fg.linkColor()).linkWidth(fg.linkWidth()).linkDirectionalParticles(fg.linkDirectionalParticles());
  };
  const resizeNodes = () => {
    for (const n of shown) {
      const r = nodeRadius(n);
      n.__threeObj?.scale.set(r, r, r);
    }
  };
  const labelLit = () => {
    for (const o of labelled) o.parent?.remove(o);
    labelled = [];
    const f = focusNode();
    if (!S.display.labels || !f) return;
    const list = litNodes.size <= LABELS_MAX ? [...litNodes] : [f];
    for (const n of list) {
      const mesh = n.__threeObj;
      if (!mesh) continue;
      const div = document.createElement("div");
      div.className = "g3__label" + (n === f ? " is-focus" : "");
      div.textContent = n.label;
      const obj = new CSS2DObject(div);
      obj.position.set(0, 1.4, 0);
      obj.center.set(0.5, 1);
      mesh.add(obj);
      labelled.push(obj);
    }
  };
  const indexCommunities = () => {
    const size = /* @__PURE__ */ new Map();
    for (const n of data?.nodes || []) if (n.communityName) size.set(n.communityName, (size.get(n.communityName) || 0) + 1);
    communityRank = new Map([...size.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name], i) => [name, i]));
  };
  const nodeFor = (raw) => {
    const key = S.source + "\n" + raw.id;
    let n = nodeCache.get(key);
    if (!n) {
      const path2 = raw.path ?? (isGraphify() ? "" : raw.id);
      const tags = raw.tags || [];
      const community = raw.communityName || "";
      const label = raw.title || raw.id;
      n = {
        id: raw.id,
        label,
        path: path2,
        tags,
        // A link-graph node IS a note; a Graphify node points at the note it came from.
        note: isGraphify() ? raw.note ?? null : raw.id,
        community,
        type: (raw.type || "").toLowerCase(),
        labelLower: label.toLowerCase(),
        pathLower: path2.toLowerCase(),
        tagsLower: tags.map((t) => t.toLowerCase()),
        communityLower: community.toLowerCase(),
        linkCount: raw.linkCount || 0,
        deg: 0,
        color: NODE_GREY,
        raw
      };
      nodeCache.set(key, n);
    }
    n.deg = 0;
    return n;
  };
  const rebuild = () => {
    if (!data) return;
    let source = data.nodes;
    if (isGraphify() && S.limit > 0 && source.length > S.limit) source = [...source].sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0)).slice(0, S.limit);
    const byId = /* @__PURE__ */ new Map();
    for (const raw of source) byId.set(raw.id, nodeFor(raw));
    const pairs = [];
    const seen = /* @__PURE__ */ new Set();
    for (const e of data.edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b || a === b) continue;
      const key = a.id < b.id ? a.id + "\n" + b.id : b.id + "\n" + a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b, e.inferred === true]);
    }
    const terms = parseQuery(S.search);
    let keep = /* @__PURE__ */ new Set();
    for (const n of byId.values()) if (!terms.length || matchesAll(n, terms)) keep.add(n);
    let kept = pairs.filter(([a, b]) => keep.has(a) && keep.has(b));
    const root2 = localRoot ? byId.get(localRoot) : void 0;
    if (localRoot && !root2) localRoot = null;
    if (root2) {
      const adj = /* @__PURE__ */ new Map();
      for (const [a, b] of kept) {
        (adj.get(a) || adj.set(a, []).get(a)).push(b);
        (adj.get(b) || adj.set(b, []).get(b)).push(a);
      }
      const reach = /* @__PURE__ */ new Set([root2]);
      let frontier = [root2];
      for (let d = 0; d < S.depth; d++) {
        const next = [];
        for (const n of frontier) for (const m of adj.get(n) || []) if (!reach.has(m)) {
          reach.add(m);
          next.push(m);
        }
        frontier = next;
      }
      keep = reach;
      kept = kept.filter(([a, b]) => keep.has(a) && keep.has(b));
    }
    for (const [a, b] of kept) {
      a.deg++;
      b.deg++;
    }
    if (!S.orphans && !root2) keep = new Set([...keep].filter((n) => n.deg > 0));
    shown = [...keep];
    shownLinks = kept.map(([a, b, inferred]) => ({ source: a.id, target: b.id, inferred }));
    compileGroups();
    for (const n of shown) n.color = baseColor(n);
    if (selected && !keep.has(selected)) selected = null;
    hoverNode = null;
    hoverLink = null;
    ensureGraph();
    fg.graphData({ nodes: shown, links: shownLinks });
    indexLinks(kept);
    light();
    setTimeout(() => {
      resizeNodes();
      light();
    }, 60);
    renderCard();
    renderTop();
    updateHud();
  };
  const indexLinks = (kept) => {
    neighbours.clear();
    linksOf.clear();
    kept.forEach(([a, b], i) => {
      const l = shownLinks[i];
      (neighbours.get(a) || neighbours.set(a, /* @__PURE__ */ new Set()).get(a)).add(b);
      (neighbours.get(b) || neighbours.set(b, /* @__PURE__ */ new Set()).get(b)).add(a);
      (linksOf.get(a) || linksOf.set(a, []).get(a)).push(l);
      (linksOf.get(b) || linksOf.set(b, []).get(b)).push(l);
    });
  };
  const recolor = () => {
    compileGroups();
    for (const n of shown) n.color = baseColor(n);
    repaint();
    if (selected) renderCard();
  };
  const updateHud = () => {
    if (!data) {
      hudEl.textContent = "";
      return;
    }
    const total = data.nodes.length;
    const count = shown.length === total ? `${total.toLocaleString()} ${noun()}` : `${shown.length.toLocaleString()} of ${total.toLocaleString()} ${noun()}`;
    hudEl.textContent = `${count} \xB7 ${shownLinks.length.toLocaleString()} links`;
  };
  const select = (n) => {
    selected = n;
    light();
    renderCard();
  };
  const openNode = (n) => {
    if (!n.note) return;
    host.open({ id: n.id, note: n.note, title: n.label, quote: isGraphify() ? n.label : "", path: n.path, raw: n.raw });
  };
  const showLocal = (n) => {
    localRoot = n ? n.id : null;
    rebuild();
    fg.d3ReheatSimulation();
    setTimeout(() => fitView(1200), 900);
  };
  const setDepth = (dir) => {
    const next = Math.max(1, Math.min(DEPTH_MAX, S.depth + dir));
    if (next === S.depth) return;
    S.depth = next;
    persist();
    if (localRoot) {
      rebuild();
      fg.d3ReheatSimulation();
    } else renderTop();
  };
  const setOrbit = (on) => {
    S.orbit = on;
    if (fg) fg.controls().autoRotate = on;
    persist();
    renderDock();
  };
  const stopOrbit = () => {
    setOrbit(false);
    if (fg) fitView(900);
  };
  const changeSpeed = (dir) => {
    const i = SPEED_STEPS2.indexOf(S.speed);
    S.speed = SPEED_STEPS2[Math.max(0, Math.min(SPEED_STEPS2.length - 1, (i < 0 ? 2 : i) + dir))];
    if (fg) fg.controls().autoRotateSpeed = rotateSpeedFor(S.speed);
    persist();
    renderDock();
  };
  const loadSource = async (source) => {
    const src = sourceById(source) || SOURCES[0];
    source = src.id;
    S.source = source;
    localRoot = null;
    selected = null;
    persist();
    renderTop();
    let g = cache.get(source);
    if (!g) {
      loading = true;
      msgEl.hidden = false;
      msgEl.textContent = src.loadingText || "Reading the graph\u2026";
      try {
        g = await host.request("graph", { source });
        if (!g || !Array.isArray(g.nodes)) throw new Error("no graph data");
        cache.set(source, g);
      } finally {
        loading = false;
      }
    }
    if (destroyed || S.source !== source) return;
    data = g;
    msgEl.hidden = !!data.nodes.length;
    if (!data.nodes.length) msgEl.textContent = src.emptyText || "There is nothing to draw yet.";
    indexCommunities();
    renderPanel();
    rebuild();
    viewerMoved = false;
    if (firstFitTimer) clearTimeout(firstFitTimer);
    firstFitTimer = setTimeout(() => {
      if (!viewerMoved) fitView(1500);
    }, 2500);
    host.notify?.("ready", { nodes: data.nodes.length, links: shownLinks.length });
  };
  const renderTop = () => {
    const root2 = localRoot && data ? shown.find((n) => n.id === localRoot) : null;
    topEl.innerHTML = `
    ${SOURCES.length > 1 ? `<div class="g3__seg" role="group" aria-label="Source">${SOURCES.map((src) => `
      <button type="button" class="g3__segb${S.source === src.id ? " is-active" : ""}" data-source="${escapeHtml(src.id)}"${src.title ? ` title="${escapeHtml(src.title)}"` : ""}${loading ? " disabled" : ""}>${escapeHtml(src.label)}</button>`).join("")}
    </div>` : ""}
    ${root2 ? `<div class="g3__local">
      <span class="g3__local-t">Local graph \xB7 <b>${escapeHtml(root2.label)}</b></span>
      <span class="g3__depth" title="How many links away from the note">
        <button type="button" class="g3__tbtn" data-act="depth-" title="Fewer steps"${S.depth <= 1 ? " disabled" : ""}>${icons.minus}</button>
        <span>Depth ${S.depth}</span>
        <button type="button" class="g3__tbtn" data-act="depth+" title="More steps"${S.depth >= DEPTH_MAX ? " disabled" : ""}>${icons.plus}</button>
      </span>
      <button type="button" class="g3__chip" data-act="whole">Whole graph</button>
    </div>` : ""}`;
  };
  const renderDock = () => {
    dockEl.innerHTML = `
    <div class="g3__transport" role="group" aria-label="Orbit">
      <button type="button" class="g3__tbtn${S.orbit ? " is-active" : ""}" data-act="orbit" title="${S.orbit ? "Pause" : "Play"}">${S.orbit ? icons.pause : icons.play}</button>
      <button type="button" class="g3__tbtn" data-act="stop" title="Stop and fit the graph">${icons.stop}</button>
      <button type="button" class="g3__tbtn" data-act="slower" title="Slower"${S.speed <= SPEED_STEPS2[0] ? " disabled" : ""}>${icons.minus}</button>
      <span class="g3__speed" title="One full turn every ${secondsPerTurn()} seconds">${S.speed}\xD7</span>
      <button type="button" class="g3__tbtn" data-act="faster" title="Faster"${S.speed >= SPEED_STEPS2[SPEED_STEPS2.length - 1] ? " disabled" : ""}>${icons.plus}</button>
    </div>
    <button type="button" class="g3__round" data-act="fit" title="Fit to view">${icons.fit}</button>`;
  };
  const renderCard = () => {
    const n = selected;
    cardEl.hidden = !n;
    if (!n) return;
    const where = n.path.replace(/^wiki\//, "").replace(/\.md$/, "");
    const sub = isGraphify() ? `${n.community || n.type || "idea"}${where ? " \xB7 " + where : ""}` : `${where.replace(/\/[^/]*$/, "") || "wiki"} \xB7 ${n.deg} links`;
    const isRoot = localRoot === n.id;
    cardEl.innerHTML = `
    <span class="g3__card-dot" style="background:${escapeHtml(n.color)}"></span>
    <div class="g3__card-t"><div class="g3__card-title">${escapeHtml(n.label)}</div><div class="g3__card-sub">${escapeHtml(sub)}</div></div>
    <button type="button" class="g3__chip" data-act="${isRoot ? "whole" : "local"}">${isRoot ? "Whole graph" : "Local graph"}</button>
    <button type="button" class="g3__open" data-act="open"${n.note ? "" : " disabled"}>${n.note ? "Open note" : "No note"}</button>`;
  };
  const section = (id, title, body, tools = "") => `
<section class="g3__sec${S.open[id] ? "" : " is-closed"}" data-sec="${id}">
  <header class="g3__sec-h">
    <button type="button" class="g3__sec-t" data-toggle="${id}">${S.open[id] ? icons.chevronDown : icons.chevronRight}${title}</button>
    ${tools}
  </header>
  <div class="g3__sec-b">${body}</div>
</section>`;
  const toggleRow = (label, key, on) => `
<label class="g3__row"><span>${label}</span><span class="g3__switch"><input type="checkbox" data-switch="${key}"${on ? " checked" : ""}><span></span></span></label>`;
  const sliderRow = (label, key, value, min, max, step) => `
<label class="g3__slider"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  const limitRow = () => {
    const total = data?.nodes.length || 0;
    if (!isGraphify() || total <= LIMIT_OPTIONS[0]) return "";
    const options = LIMIT_OPTIONS.filter((n) => n < total).map((n) => `<option value="${n}"${S.limit === n ? " selected" : ""}>Top ${n.toLocaleString()}</option>`).join("");
    return `<label class="g3__row"><span>Show</span><select class="g3__select" data-select="limit">${options}<option value="0"${S.limit === 0 || S.limit >= total ? " selected" : ""}>All ${total.toLocaleString()}</option></select></label>`;
  };
  const groupRows = () => S.groups.map((g, i) => `
<div class="g3__group">
  <input type="text" class="g3__group-q" data-group-q="${i}" value="${escapeHtml(g.query)}" placeholder="path:concepts, tag:name \u2026" spellcheck="false" autocapitalize="off" autocorrect="off">
  <label class="g3__swatch" style="background:${escapeHtml(g.color)}" title="Colour"><input type="color" data-group-c="${i}" value="${escapeHtml(g.color)}"></label>
  <button type="button" class="g3__x" data-group-x="${i}" title="Remove group">${icons.close}</button>
</div>`).join("") + `<button type="button" class="g3__new" data-act="new-group">New group</button>`;
  const renderPanel = () => {
    const colourBy = isGraphify() ? `
    <div class="g3__row"><span>Colour by</span><span class="g3__seg g3__seg--small">
      <button type="button" class="g3__segb${S.colorBy === "groups" ? " is-active" : ""}" data-color="groups">Folder</button>
      <button type="button" class="g3__segb${S.colorBy === "community" ? " is-active" : ""}" data-color="community">Community</button>
    </span></div>` : "";
    panelEl.innerHTML = section(
      "filters",
      "Filters",
      `
      <label class="g3__search">${icons.search}
        <input type="text" data-bind="search" value="${escapeHtml(S.search)}" placeholder="Search files\u2026" spellcheck="false" autocapitalize="off" autocorrect="off">
      </label>
      <div class="g3__hint">path:folder &nbsp; file:name &nbsp; tag:name &nbsp; ${isGraphify() ? "community:name &nbsp; type:concept &nbsp; " : ""}-not</div>
      ${toggleRow("Orphans", "orphans", S.orphans)}
      ${limitRow()}`,
      `<span class="g3__sec-tools">
        <button type="button" data-act="reset" title="Restore default settings">${icons.reset}</button>
        <button type="button" data-act="close" title="Close">${icons.close}</button>
      </span>`
    ) + section("groups", "Groups", `${colourBy}<div data-groups class="g3__groups">${groupRows()}</div>`) + section(
      "display",
      "Display",
      sliderRow("Node size", "display.nodeSize", S.display.nodeSize, 0.2, 4, 0.1) + sliderRow("Link thickness", "display.linkThickness", S.display.linkThickness, 0, 4, 0.1) + sliderRow("Link opacity", "display.linkOpacity", S.display.linkOpacity, 0.05, 1, 0.05) + sliderRow("Particle size", "display.particleSize", S.display.particleSize, 0.5, 6, 0.1) + sliderRow("Particle count", "display.particleCount", S.display.particleCount, 0, 10, 1) + toggleRow("Name labels", "labels", S.display.labels)
    ) + section(
      "forces",
      "Forces",
      sliderRow("Center force", "forces.center", S.forces.center, 0, 1, 0.01) + sliderRow("Repel force", "forces.repel", S.forces.repel, 0, 20, 0.1) + sliderRow("Link distance", "forces.linkDistance", S.forces.linkDistance, 10, 200, 1)
    );
  };
  const renderGroups = () => {
    const el = panelEl.querySelector("[data-groups]");
    if (el) el.innerHTML = groupRows();
  };
  let rebuildTimer = null;
  const scheduleRebuild = () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      rebuild();
      fg?.d3ReheatSimulation();
    }, 200);
  };
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act],[data-source],[data-color],[data-toggle],[data-group-x]");
    if (!t) return;
    if (t.dataset.source) {
      if (t.dataset.source !== S.source && !loading) void loadSource(t.dataset.source).catch(fail);
      return;
    }
    if (t.dataset.color) {
      S.colorBy = t.dataset.color;
      persist();
      recolor();
      renderPanel();
      return;
    }
    if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      S.open[id] = !S.open[id];
      panelEl.querySelector(`[data-sec="${id}"]`)?.classList.toggle("is-closed", !S.open[id]);
      t.innerHTML = (S.open[id] ? icons.chevronDown : icons.chevronRight) + escapeHtml(t.textContent || "");
      persist();
      return;
    }
    if (t.dataset.groupX != null) {
      S.groups.splice(Number(t.dataset.groupX), 1);
      renderGroups();
      recolor();
      persist();
      return;
    }
    switch (t.dataset.act) {
      case "orbit":
        setOrbit(!S.orbit);
        break;
      case "stop":
        stopOrbit();
        break;
      case "slower":
        changeSpeed(-1);
        break;
      case "faster":
        changeSpeed(1);
        break;
      case "fit":
        fitView(900);
        break;
      case "open":
        if (selected) openNode(selected);
        break;
      case "local":
        if (selected) showLocal(selected);
        break;
      case "whole":
        showLocal(null);
        break;
      case "depth-":
        setDepth(-1);
        break;
      case "depth+":
        setDepth(1);
        break;
      case "close":
        showPanel(false);
        break;
      case "reset": {
        const source = S.source;
        Object.assign(S, defaults(), { open: S.open, source });
        renderPanel();
        renderDock();
        applyForces();
        recolor();
        if (fg) {
          fg.linkOpacity(S.display.linkOpacity).linkDirectionalParticleWidth(S.display.particleSize);
          fg.controls().autoRotate = S.orbit;
          fg.controls().autoRotateSpeed = rotateSpeedFor(S.speed);
        }
        rebuild();
        fg?.d3ReheatSimulation();
        persist();
        break;
      }
      case "new-group":
        S.groups.push({ query: "", color: NEW_GROUP_COLORS[S.groups.length % NEW_GROUP_COLORS.length] });
        renderGroups();
        persist();
        panelEl.querySelector(`[data-group-q="${S.groups.length - 1}"]`)?.focus();
        break;
    }
  });
  gearEl.addEventListener("click", () => showPanel(true));
  panelEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.bind === "search") {
      S.search = t.value;
      scheduleRebuild();
      persist();
      return;
    }
    if (t.dataset.groupQ != null) {
      S.groups[Number(t.dataset.groupQ)].query = t.value;
      recolor();
      persist();
      return;
    }
    if (t.dataset.groupC != null) {
      S.groups[Number(t.dataset.groupC)].color = t.value;
      t.parentElement.style.background = t.value;
      recolor();
      persist();
      return;
    }
    if (!t.dataset.range) return;
    const [a, b] = t.dataset.range.split(".");
    S[a][b] = Number(t.value);
    if (a === "forces") {
      applyForces();
      fg?.d3ReheatSimulation();
    } else if (b === "nodeSize") resizeNodes();
    else if (b === "linkOpacity") fg?.linkOpacity(S.display.linkOpacity);
    else if (b === "particleSize") fg?.linkDirectionalParticleWidth(S.display.particleSize);
    else repaint();
    persist();
  });
  panelEl.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.select === "limit") {
      S.limit = Number(t.value) || 0;
      persist();
      scheduleRebuild();
      return;
    }
    if (t.dataset.switch === "orphans") {
      S.orphans = t.checked;
      scheduleRebuild();
    } else if (t.dataset.switch === "labels") {
      S.display.labels = t.checked;
      labelLit();
    }
    persist();
  });
  const fail = (err) => {
    msgEl.hidden = false;
    msgEl.textContent = "Could not load the graph.";
    renderTop();
    host.notify?.("failed", { message: err instanceof Error ? err.message : "unknown" });
  };
  const start = async () => {
    renderPanel();
    showPanel(panelOpen);
    renderDock();
    renderTop();
    if (opts.initialData) cache.set(SOURCES[0].id, opts.initialData);
    try {
      await loadSource(S.source);
    } catch (err) {
      fail(err);
    }
  };
  (host.debug ? window : {}).__kg3d = { fg: () => fg, shown: () => shown, links: () => shownLinks, settings: () => S, lit: () => ({ nodes: litNodes.size, links: litLinks.size }), select: (id) => select(shown.find((n) => n.id === id) || null), local: (id) => showLocal(id ? shown.find((n) => n.id === id) || null : null), hover: (id) => {
    hoverNode = id ? shown.find((n) => n.id === id) || null : null;
    light();
  }, labels: () => labelled.length };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (firstFitTimer) clearTimeout(firstFitTimer);
    if (rebuildTimer) clearTimeout(rebuildTimer);
    resizeObserver?.disconnect();
    if (fg) {
      fg.pauseAnimation?.();
      fg._destructor?.();
      fg = null;
    }
    app.innerHTML = "";
    if (window.__kg3d?.page === page) delete window.__kg3d;
  };
  const page = { destroy };
  if (host.debug) window.__kg3d.page = page;
  start();
  return page;
}

// src/semantic/main.ts
import ForceGraph3D2 from "3d-force-graph";
import * as THREE2 from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { CSS2DObject as CSS2DObject2, CSS2DRenderer as CSS2DRenderer2 } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// src/semantic/semantic.css
var semantic_default = `/* Everything is scoped to the page root, so a graph can live inside any app's
   layout as well as fill a whole page or web view. */
.sg { --accent: #8b7cf6; color-scheme: dark;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.sg, .sg *, .sg *::before, .sg *::after { box-sizing: border-box; }
.sg button { font: inherit; color: inherit; }

.sg { position: absolute; inset: 0; background: #0e1014; color: #e7e9ed; font-size: 12px; }
.sg__canvas { position: absolute; inset: 0; touch-action: none; z-index: 0; }
.sg__msg { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center; text-align: center; padding: 24px; color: #9aa1ad; font-size: 14px; pointer-events: none; }
.sg__msg button { pointer-events: auto; }
.sg__msg[hidden] { display: none; }
.sg__hud { position: absolute; left: 12px; bottom: 10px; font-size: 11px; color: #9aa1ad; pointer-events: none; }

.sg__toolbar {
  position: absolute; top: 10px; left: 10px; right: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  padding: 6px 8px; border-radius: 10px; background: rgba(20, 23, 31, .86);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border: 1px solid #262b38;
}
.sg__sep { width: 1px; height: 18px; background: #2f3547; margin: 0 2px; }
.sg__label { font-size: 10.5px; color: #8790a3; text-transform: uppercase; letter-spacing: .05em; }
.sg__spacer { flex: 1; min-width: 4px; }
.sg__chip {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 11px;
  border: 1px solid #2f3547; border-radius: 14px; background: transparent; color: #b6bdcc; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.sg__chip:hover { background: #222838; color: #fff; }
.sg__chip.is-active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); color: #fff; }
.sg__chip:disabled { opacity: .5; cursor: default; }
.sg__primary { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 600; }
.sg__primary:hover { background: color-mix(in srgb, var(--accent) 85%, #fff); }

.sg__transport { display: inline-flex; align-items: center; gap: 2px; height: 34px; padding: 0 4px; border: 1px solid #2f3547; border-radius: 17px; }
.sg__tbtn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 0; border-radius: 15px; background: transparent; color: #b6bdcc; cursor: pointer; padding: 0; }
.sg__tbtn svg { width: 17px; height: 17px; }
.sg__tbtn:hover:not(:disabled) { background: #222838; color: #fff; }
.sg__tbtn.is-active { background: color-mix(in srgb, var(--accent) 22%, transparent); color: #fff; }
.sg__tbtn:disabled { opacity: .35; cursor: default; }
.sg__speed { min-width: 46px; text-align: center; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: #fff; }

.sg__search { display: flex; align-items: center; gap: 6px; height: 30px; width: min(260px, 100%); padding: 0 10px; border-radius: 15px; background: #0e1118; border: 1px solid #2f3547; color: #8790a3; }
.sg__search input { flex: 1; min-width: 0; border: 0; background: transparent; color: #fff; font: inherit; font-size: 13px; outline: none; -webkit-user-select: text; user-select: text; }
.sg__search button { border: 0; background: transparent; color: #8790a3; display: inline-flex; padding: 0; cursor: pointer; }
.sg__stamp { color: #8790a3; font-size: 11px; white-space: nowrap; }
.sg__stale { color: #ffb340; }

.sg__legend, .sg__side {
  position: absolute; width: 240px; overflow: auto; padding: 10px 12px; border-radius: 10px;
  background: rgba(20, 23, 31, .88); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border: 1px solid #262b38;
}
.sg__legend { left: 10px; max-height: calc(60% - 20px); }
.sg__side { right: 10px; max-height: calc(100% - 100px); }
.sg__legend[hidden], .sg__side[hidden] { display: none; }
.sg__title { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #8790a3; margin-bottom: 6px; }
.sg__title--sub { margin-top: 12px; }
.sg__title button { border: 0; background: transparent; color: #8790a3; cursor: pointer; font-size: 11px; padding: 0; text-transform: none; letter-spacing: 0; }
.sg__title button:hover { color: #fff; }
.sg__lrow { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
.sg__lrow.is-dim { opacity: .45; }
.sg__lrow.is-focus .sg__llabel { color: #fff; font-weight: 600; }
.sg__swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.sg__llabel { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #c8d3f5; }
.sg__ln { color: #8790a3; font-variant-numeric: tabular-nums; }
.sg__hint { margin-top: 8px; font-size: 11px; color: #6b7280; }

.sg__hit { display: flex; align-items: center; gap: 8px; padding: 5px 0; cursor: pointer; }
.sg__hit:hover .sg__hlabel, .sg__hit.is-active .sg__hlabel { color: #fff; }
.sg__score { width: 36px; color: #7aa2f7; font-weight: 600; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.sg__hlabel { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #c8d3f5; }
.sg__hkind { color: #6b7280; font-size: 11px; }
.sg__sel { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 6px; line-height: 19px; }
.sg__meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
.sg__tag { padding: 1px 7px; border: 1px solid #2f334d; border-radius: 8px; font-size: 11px; color: #c8d3f5; }
.sg__open { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; border: 0; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; }
.sg__error { color: #ff8f8f; font-size: 12px; margin: 4px 0; }

.sg__tip { padding: 2px 8px; border-radius: 6px; background: #1f2335; color: #c0caf5; font-size: 11px; border: 1px solid #2f334d; }

/* Phone width: the side card docks to the bottom, the legend hides behind a chip. */
.sg.is-compact .sg__toolbar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.sg.is-compact .sg__toolbar::-webkit-scrollbar { display: none; }
.sg.is-compact .sg__search { width: 190px; flex-shrink: 0; }
.sg.is-compact .sg__legend { width: min(260px, calc(100% - 20px)); max-height: 46%; }
.sg.is-compact .sg__side { left: 10px; right: 10px; width: auto; top: auto !important; bottom: 34px; max-height: 44%; }

/* Settings panel: the 3D Knowledge Graph's, docked under the toolbar on the right. */
.sg__panel {
  position: absolute; right: 10px; width: min(300px, calc(100% - 20px)); max-height: calc(100% - 110px); overflow: auto; z-index: 2;
  border-radius: 10px; background: rgba(20, 23, 31, .95); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border: 1px solid #262b38;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .4); font-size: 13px;
}
.sg__panel[hidden] { display: none; }
.sg__side.is-beside { right: 320px; }
.sg__sec { border-bottom: 1px solid #262b38; }
.sg__sec:last-child { border-bottom: 0; }
.sg__sec-h { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 10px 8px; }
.sg__sec-t { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; font-size: 15px; font-weight: 600; cursor: pointer; padding: 0; color: #e7e9ed; }
.sg__sec-tools { display: inline-flex; gap: 2px; }
.sg__sec-tools button, .sg__x { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 6px;
  background: transparent; color: #8790a3; cursor: pointer; padding: 0; flex-shrink: 0; }
.sg__sec-tools button:hover, .sg__x:hover { background: #222838; color: #fff; }
.sg__sec-b { padding: 0 14px 12px; display: flex; flex-direction: column; gap: 10px; }
.sg__sec.is-closed .sg__sec-b { display: none; }
.sg__sec-b .sg__hint { margin-top: 0; }
.sg__psearch { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 8px; background: #0e1118; border: 1px solid #2f3547; color: #8790a3; }
.sg__psearch input, .sg__group-q { flex: 1; min-width: 0; border: 0; background: transparent; color: #fff; font: inherit; outline: none; -webkit-user-select: text; user-select: text; }
.sg__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; color: #c8d3f5; }
.sg__switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
.sg__switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.sg__switch span { position: absolute; inset: 0; border-radius: 10px; background: #3a4054; transition: background .18s ease; pointer-events: none; }
.sg__switch span::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .18s ease; }
.sg__switch input:checked + span { background: var(--accent); }
.sg__switch input:checked + span::after { transform: translateX(16px); }
.sg__slider { display: flex; flex-direction: column; gap: 4px; color: #c8d3f5; }
.sg__slider input[type=range] { width: 100%; accent-color: var(--accent); margin: 0; }
.sg__groups { display: flex; flex-direction: column; gap: 10px; }
.sg__group { display: flex; align-items: center; gap: 8px; }
.sg__group-q { height: 32px; padding: 0 10px; border-radius: 8px; background: #0e1118; border: 1px solid #2f3547; }
.sg__gswatch { position: relative; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35); }
.sg__gswatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; padding: 0; border: 0; }
.sg__new { height: 32px; border-radius: 8px; border: 1px solid #2f3547; background: transparent; color: #c8d3f5; cursor: pointer; }
.sg__new:hover { background: #222838; color: #fff; }
.sg__chip svg { width: 14px; height: 14px; }

/* Name labels over the lit neighbourhood. */
.sg__nlabel { padding: 1px 6px; border-radius: 5px; background: rgba(14, 16, 20, .74); color: #e6e8ee; font-size: 11px; white-space: nowrap;
  font-family: -apple-system, "SF Pro Text", Helvetica, sans-serif; pointer-events: none; transform: translateY(-4px); }
.sg__nlabel.is-focus { color: #fff; font-weight: 600; font-size: 12px; border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent); }
.sg__toolbar, .sg__legend, .sg__side, .sg__hud, .sg__msg { z-index: 2; }
.sg.is-compact .sg__panel { left: 10px; right: 10px; width: auto; }
`;

// src/semantic/main.ts
var PALETTE = [
  "#e0498a",
  "#f28c28",
  "#3dbb5b",
  "#3f7fe0",
  "#8b5cf6",
  "#22b8cf",
  "#e5484d",
  "#14b8a6",
  "#d97706",
  "#6366f1",
  "#ec4899",
  "#84cc16",
  "#0ea5e9",
  "#a855f7",
  "#f43f5e",
  "#10b981",
  "#eab308",
  "#2563eb",
  "#c026d3",
  "#fb7185",
  "#4ade80",
  "#38bdf8",
  "#f97316",
  "#a3e635"
];
var SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
var DIM = "#2a2f3a";
var ENTRY_MS = 4200;
function mountSemantic(root, host, opts) {
  const SETTINGS_KEY = opts.settingsKey;
  const CATEGORIES = opts.categories;
  const SCOPES = opts.scopes || [];
  const catById = (id) => CATEGORIES.find((c) => c.id === id);
  let destroyed = false;
  const compact = host.compact;
  const ACCENT = host.accent || "#8b7cf6";
  const NEW_GROUP_COLORS = ["#e05252", "#e0b152", "#b1e052", "#52e052", "#52e0b1", "#52b1e0", "#5a5ae2", "#b152e0", "#e052b1", "#f28c3a"];
  const LABELS_MAX = compact ? 16 : 40;
  const defaults = () => ({
    colorBy: "cluster",
    links: true,
    hulls: true,
    orbit: true,
    speed: 1,
    legend: !compact,
    scope: (SCOPES.some((x) => x.id === opts.defaultScope) ? opts.defaultScope : SCOPES[0]?.id) || "",
    groups: [],
    display: { nodeSize: 1, linkThickness: 0, linkOpacity: 0.18, particleSize: 1.5, particleCount: 3, labels: true, spread: 1, regionOpacity: 0.07 },
    panel: false,
    open: { filters: true, groups: true, display: true },
    filter: ""
  });
  const loadSettings = () => {
    const d = defaults();
    try {
      const raw = host.loadSetting(SETTINGS_KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      return {
        colorBy: catById(s.colorBy) ? s.colorBy : "cluster",
        scope: SCOPES.some((x) => x.id === s.scope) ? s.scope : d.scope,
        links: s.links !== false,
        hulls: s.hulls !== false,
        orbit: s.orbit !== false,
        speed: SPEED_STEPS.includes(s.speed) ? s.speed : 1,
        legend: compact ? false : s.legend !== false,
        groups: Array.isArray(s.groups) ? s.groups.filter((g) => g && typeof g.query === "string" && typeof g.color === "string") : d.groups,
        display: { ...d.display, ...s.display || {} },
        panel: compact ? false : s.panel === true,
        open: { ...d.open, ...s.open || {} },
        filter: typeof s.filter === "string" ? s.filter : ""
      };
    } catch {
      return d;
    }
  };
  const S = loadSettings();
  const persist = () => host.saveSetting(SETTINGS_KEY, S);
  const FIELDS = ["path", "file", "tag", "cluster", ...CATEGORIES.map((c) => c.id)];
  const parseQuery = (q) => {
    const terms = [];
    const re = new RegExp(`(-)?(?:(${FIELDS.join("|")}):)?(?:"([^"]*)"|(\\S+))`, "g");
    let m;
    while (m = re.exec(q)) {
      const value = (m[3] ?? m[4] ?? "").toLowerCase();
      if (value) terms.push({ neg: !!m[1], field: m[2] || "any", value });
    }
    return terms;
  };
  const matchTerm = (n, t) => {
    const v = t.value.replace(/^#/, "");
    const path2 = (n.path || n.id).toLowerCase();
    const label = n.label.toLowerCase();
    const tags = n.tags.map((x) => x.toLowerCase());
    const cluster = clusterLabel(n.cluster).toLowerCase();
    let hit;
    switch (t.field) {
      case "path":
        hit = path2.includes(t.value);
        break;
      case "file":
        hit = label.includes(t.value);
        break;
      case "tag":
        hit = tags.some((x) => x === v || x.startsWith(v + "/"));
        break;
      case "cluster":
        hit = cluster.includes(t.value);
        break;
      case "any":
        hit = label.includes(t.value) || path2.includes(t.value) || tags.some((x) => x.includes(v)) || cluster.includes(t.value);
        break;
      default: {
        const cat = catById(t.field);
        hit = !!cat && (catValue(n, cat).toLowerCase().includes(t.value) || catLabel(cat, catValue(n, cat)).toLowerCase().includes(t.value));
      }
    }
    return t.neg ? !hit : hit;
  };
  const matchesAll = (n, terms) => terms.every((t) => matchTerm(n, t));
  injectStyle("graph-semantic-css", semantic_default);
  const app = root;
  app.innerHTML = `
<div class="sg${compact ? " is-compact" : ""}">
  <div class="sg__canvas"></div>
  <div class="sg__msg">Loading the semantic graph\u2026</div>
  <div class="sg__hud"></div>
  <div class="sg__toolbar"></div>
  <aside class="sg__legend" hidden></aside>
  <aside class="sg__side" hidden></aside>
  <aside class="sg__panel" hidden></aside>
</div>`;
  const $ = (sel, root2 = app) => root2.querySelector(sel);
  const canvasEl = $(".sg__canvas");
  const msgEl = $(".sg__msg");
  const hudEl = $(".sg__hud");
  const toolbarEl = $(".sg__toolbar");
  const legendEl = $(".sg__legend");
  const sideEl = $(".sg__side");
  const panelEl = $(".sg__panel");
  let status = opts.initialStatus || null;
  let initialData = opts.initialData;
  let graph = null;
  let fg = null;
  let canvasObserver = null;
  let hulls = [];
  let selected = null;
  let neighbors = [];
  let hits = [];
  let highlighted = /* @__PURE__ */ new Set();
  let focusCluster = null;
  let focusValue = null;
  let searchError = "";
  let query = "";
  let building = false;
  let pollTimer = null;
  let entryFrame = 0;
  let entryTimer = null;
  const nodeById = /* @__PURE__ */ new Map();
  let allNodes = [];
  let allLinks = [];
  const drawnById = /* @__PURE__ */ new Map();
  let filterText = S.filter;
  let hoverNode = null;
  const litNodes = /* @__PURE__ */ new Set();
  const litLinks = /* @__PURE__ */ new Set();
  let labelled = [];
  let pointerKind = host.platform === "ios" ? "touch" : "mouse";
  const hovering = () => pointerKind === "mouse" || pointerKind === "pen";
  let compiledGroups = [];
  const compileGroups = () => {
    compiledGroups = S.groups.map((g) => ({ terms: parseQuery(g.query), color: g.color }));
  };
  compileGroups();
  const clusterColor = (id) => PALETTE[(id % PALETTE.length + PALETTE.length) % PALETTE.length];
  const catValue = (n, cat) => {
    const v = n[cat.field];
    return v == null ? "" : String(v);
  };
  const catLabel = (cat, v) => cat.labels?.[v] || v || "None";
  let catRank = /* @__PURE__ */ new Map();
  const indexCategories = () => {
    catRank = /* @__PURE__ */ new Map();
    for (const cat of CATEGORIES) {
      const counts = /* @__PURE__ */ new Map();
      for (const n of graph?.nodes || []) {
        const v = catValue(n, cat);
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      catRank.set(cat.id, new Map([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v], i) => [v, i])));
    }
  };
  const catColor = (cat, v) => {
    const ruled = cat.colorOf?.(v);
    if (ruled) return ruled;
    if (cat.colors?.[v]) return cat.colors[v];
    if (!v) return "#6b7280";
    const r = catRank.get(cat.id)?.get(v) ?? 0;
    return PALETTE[r % PALETTE.length];
  };
  const clusterLabel = (id) => graph?.clusters.find((c) => c.id === id)?.label || String(id);
  const baseColor = (n) => {
    for (const g of compiledGroups) if (g.terms.length && matchesAll(n, g.terms)) return g.color;
    const cat = catById(S.colorBy);
    return cat ? catColor(cat, catValue(n, cat)) : clusterColor(n.cluster);
  };
  const focusNode = () => hoverNode || selected;
  const nodeColor = (n) => {
    const f = focusNode();
    if (f?.id === n.id) return "#ffffff";
    if (litNodes.size) return litNodes.has(n.id) ? baseColor(n) : DIM;
    const dim = S.colorBy === "cluster" && focusCluster !== null && n.cluster !== focusCluster || S.colorBy !== "cluster" && focusValue !== null && catById(S.colorBy) != null && catValue(n, catById(S.colorBy)) !== focusValue || highlighted.size > 0 && !highlighted.has(n.id);
    return dim ? DIM : baseColor(n);
  };
  const rotateSpeedFor = (s) => s / 2;
  const secondsPerTurn = () => Math.round(120 / S.speed * 10) / 10;
  const NODE_REL_SIZE = 1.6;
  const nodeRadius = (n) => NODE_REL_SIZE * Math.cbrt(1 + Math.min(5, Math.sqrt(n.degree || 0))) * S.display.nodeSize;
  const sphereGeom = new THREE2.SphereGeometry(1, compact ? 16 : 32, compact ? 12 : 24);
  const nodeSphere = (n) => {
    const mat = new THREE2.MeshPhongMaterial({ color: nodeColor(n), shininess: 80, specular: new THREE2.Color(6710886), transparent: true, opacity: 1 });
    const mesh = new THREE2.Mesh(sphereGeom, mat);
    const r = nodeRadius(n);
    mesh.scale.set(r, r, r);
    return mesh;
  };
  const homeCamera = () => {
    const aspect = (canvasEl.clientWidth || 1) / (canvasEl.clientHeight || 1);
    return { x: 0, y: 60, z: aspect >= 1 ? 340 : Math.min(700, 340 / Math.pow(aspect, 0.75)) };
  };
  const ensureGraph = () => {
    if (fg) return;
    const labels = new CSS2DRenderer2();
    labels.domElement.style.pointerEvents = "none";
    fg = new ForceGraph3D2(canvasEl, { controlType: "orbit", extraRenderers: [labels] }).backgroundColor("#0e1014").showNavInfo(false).enableNodeDrag(false).cooldownTime(2500).warmupTicks(0).nodeId("id").nodeLabel((n) => hovering() ? `<div class="sg__tip">${escapeHtml(n.label)}</div>` : "").nodeThreeObject((n) => nodeSphere(n)).linkOpacity(S.display.linkOpacity).linkColor((l) => litLinks.has(l) ? ACCENT : litNodes.size ? "rgba(120,128,150,0.25)" : "#8892b0").linkWidth((l) => litLinks.has(l) ? Math.max(1.2, S.display.linkThickness * 1.5) : S.display.linkThickness).linkDirectionalParticles((l) => litLinks.has(l) ? S.display.particleCount : 0).linkDirectionalParticleWidth(S.display.particleSize).linkDirectionalParticleSpeed(6e-3).linkDirectionalParticleColor(() => ACCENT).onNodeHover((n) => {
      const next = hovering() && n ? nodeById.get(n.id) || null : null;
      if (next === hoverNode) return;
      hoverNode = next;
      canvasEl.style.cursor = next ? "pointer" : "";
      light();
    }).onNodeClick((n) => {
      void selectNode(n, true);
      if (hovering()) openNote(nodeById.get(n.id) || n);
    }).onBackgroundClick(() => {
      selected = null;
      neighbors = [];
      light();
      renderSide();
    });
    for (const type of ["pointerdown", "pointermove"]) {
      canvasEl.addEventListener(type, (e) => {
        pointerKind = e.pointerType || "mouse";
      }, { capture: true, passive: true });
    }
    const key = new THREE2.DirectionalLight(16777215, 2.4);
    key.position.set(1, 1.4, 1.2);
    const fill = new THREE2.DirectionalLight(14673919, 0.9);
    fill.position.set(-1.4, -0.6, -1);
    fg.lights([new THREE2.AmbientLight(16777215, 1.1), key, fill, new THREE2.HemisphereLight(16777215, 3355460, 0.5)]);
    const controls = fg.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = S.orbit;
    controls.autoRotateSpeed = rotateSpeedFor(S.speed);
    canvasObserver = new ResizeObserver(() => fitSize());
    canvasObserver.observe(canvasEl);
    fitSize();
    if (host.debug) window.__kgSemanticGraph = fg;
    (host.debug ? window : {}).__kgSemantic = { settings: () => S, lit: () => ({ nodes: litNodes.size, links: litLinks.size }), labels: () => labelled.length, hover: (id) => {
      hoverNode = id ? nodeById.get(id) || null : null;
      light();
    }, filter: (q) => {
      filterText = q;
      applyFilter();
    }, shown: () => fg.graphData().nodes.length };
  };
  const fitSize = () => {
    if (fg) fg.width(canvasEl.clientWidth).height(canvasEl.clientHeight);
  };
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const animateEntry = (nodes, onDone) => {
    cancelAnimationFrame(entryFrame);
    if (entryTimer) clearTimeout(entryTimer);
    const started = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    let finished = false;
    const place = (f) => {
      for (const n of nodes) {
        n.fx = n.tx * f;
        n.fy = n.ty * f;
        n.fz = n.tz * f;
        n.x = n.fx;
        n.y = n.fy;
        n.z = n.fz;
        if (n.__threeObj) n.__threeObj.position.set(n.fx, n.fy, n.fz);
      }
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(entryFrame);
      place(1);
      onDone();
    };
    const step = (now) => {
      if (finished) return;
      const t = Math.min(1, (now - started) / ENTRY_MS);
      place(ease(t));
      if (t < 1) entryFrame = requestAnimationFrame(step);
      else finish();
    };
    entryFrame = requestAnimationFrame(step);
    entryTimer = setTimeout(finish, ENTRY_MS + 600);
  };
  const render = () => {
    if (!fg || !graph) return;
    const animate = !reducedMotion();
    const k = S.display.spread;
    allNodes = graph.nodes.map((n) => ({ ...n, x0: n.x, y0: n.y, z0: n.z, tx: n.x * k, ty: n.y * k, tz: n.z * k, fx: animate ? 0 : n.x * k, fy: animate ? 0 : n.y * k, fz: animate ? 0 : n.z * k }));
    allLinks = graph.links.map((l) => ({ ...l }));
    drawnById.clear();
    for (const n of allNodes) drawnById.set(n.id, n);
    const home = homeCamera();
    if (!animate) {
      applyFilter();
      drawHulls();
      fg.cameraPosition(home, { x: 0, y: 0, z: 0 }, 800);
      return;
    }
    applyFilter(false);
    fg.cameraPosition({ x: 0, y: 220, z: home.z * 2.6 }, { x: 0, y: 0, z: 0 }, 0);
    setTimeout(() => fg && fg.cameraPosition(home, { x: 0, y: 0, z: 0 }, ENTRY_MS), 60);
    animateEntry(allNodes, () => {
      if (!fg) return;
      applyFilter();
      drawHulls();
    });
  };
  const applyFilter = (withLinks = true) => {
    if (!fg) return;
    const terms = parseQuery(filterText);
    const nodes = terms.length ? allNodes.filter((n) => matchesAll(n, terms)) : allNodes;
    const keep = new Set(nodes.map((n) => n.id));
    const idOf = (end) => typeof end === "object" ? end.id : end;
    const matching = S.links ? allLinks.filter((l) => keep.has(idOf(l.source)) && keep.has(idOf(l.target))) : [];
    const links = withLinks ? matching : [];
    fg.graphData({ nodes, links });
    if (hoverNode && !keep.has(hoverNode.id)) hoverNode = null;
    light();
    setTimeout(() => {
      resizeNodes();
      light();
    }, 60);
    hudEl.textContent = hudText(nodes.length, matching.length);
  };
  const hudText = (nodes, links) => {
    if (!graph) return "";
    const total = graph.nodes.length;
    const count = nodes === total ? `${total.toLocaleString()} notes` : `${nodes.toLocaleString()} of ${total.toLocaleString()} notes`;
    return `${count} \xB7 ${links.toLocaleString()} links \xB7 ${graph.clusters.length} cluster${graph.clusters.length === 1 ? "" : "s"}`;
  };
  const applySpread = () => {
    const k = S.display.spread;
    for (const n of allNodes) {
      n.tx = n.x0 * k;
      n.ty = n.y0 * k;
      n.tz = n.z0 * k;
      n.fx = n.tx;
      n.fy = n.ty;
      n.fz = n.tz;
    }
    fg?.d3ReheatSimulation();
    drawHulls();
  };
  const resizeNodes = () => {
    for (const n of allNodes) {
      const r = nodeRadius(n);
      n.__threeObj?.scale.set(r, r, r);
    }
  };
  const light = () => {
    litNodes.clear();
    litLinks.clear();
    const f = focusNode();
    if (f && fg) {
      litNodes.add(f.id);
      for (const l of fg.graphData().links) {
        const a = typeof l.source === "object" ? l.source.id : l.source;
        const b = typeof l.target === "object" ? l.target.id : l.target;
        if (a === f.id || b === f.id) {
          litLinks.add(l);
          litNodes.add(a);
          litNodes.add(b);
        }
      }
    }
    repaint();
    if (fg) fg.linkColor(fg.linkColor()).linkWidth(fg.linkWidth()).linkDirectionalParticles(fg.linkDirectionalParticles());
    labelLit();
  };
  const labelLit = () => {
    for (const o of labelled) o.parent?.remove(o);
    labelled = [];
    const f = focusNode();
    if (!S.display.labels || !f) return;
    const ids = litNodes.size <= LABELS_MAX ? [...litNodes] : [f.id];
    for (const id of ids) {
      const mesh = drawnById.get(id)?.__threeObj;
      if (!mesh) continue;
      const div = document.createElement("div");
      div.className = "sg__nlabel" + (id === f.id ? " is-focus" : "");
      div.textContent = nodeById.get(id)?.label || id;
      const obj = new CSS2DObject2(div);
      obj.position.set(0, 1.4, 0);
      obj.center.set(0.5, 1);
      mesh.add(obj);
      labelled.push(obj);
    }
  };
  const repaint = () => {
    if (!fg) return;
    for (const n of fg.graphData().nodes) {
      const mat = n.__threeObj?.material;
      if (!mat?.color) continue;
      mat.color.set(nodeColor(n));
      mat.opacity = litNodes.size && !litNodes.has(n.id) ? 0.35 : 1;
    }
  };
  const drawHulls = () => {
    if (!fg) return;
    const scene = fg.scene();
    for (const h of hulls) {
      scene.remove(h);
      h.geometry.dispose();
      h.material.dispose();
    }
    hulls = [];
    if (!S.hulls || !graph || S.colorBy !== "cluster") return;
    const byCluster = /* @__PURE__ */ new Map();
    for (const n of graph.nodes) {
      if (!byCluster.has(n.cluster)) byCluster.set(n.cluster, []);
      const k = S.display.spread;
      byCluster.get(n.cluster).push(new THREE2.Vector3(n.x * k, n.y * k, n.z * k));
    }
    for (const [id, pts] of byCluster) {
      if (pts.length < 4) continue;
      try {
        const mat = new THREE2.MeshBasicMaterial({ color: clusterColor(id), transparent: true, opacity: S.display.regionOpacity, side: THREE2.DoubleSide, depthWrite: false });
        const mesh = new THREE2.Mesh(new ConvexGeometry(pts), mat);
        scene.add(mesh);
        hulls.push(mesh);
      } catch {
      }
    }
  };
  const flyTo = (n) => {
    if (!fg) return;
    const k = S.display.spread;
    const x = n.x * k, y = n.y * k, z = n.z * k;
    const d = Math.hypot(x, y, z) || 1;
    const ratio = 1 + 120 / d;
    fg.cameraPosition({ x: x * ratio, y: y * ratio, z: z * ratio }, { x, y, z }, 900);
  };
  const selectNode = async (n, fly) => {
    selected = nodeById.get(n.id) || n;
    neighbors = [];
    light();
    renderSide();
    if (fly) flyTo(selected);
    try {
      const res = await host.request("semanticNeighbors", { id: selected.id, limit: 8, scope: S.scope });
      if (selected?.id === n.id) {
        neighbors = res?.results || [];
        renderSide();
      }
    } catch {
    }
  };
  const selectById = (id, fly) => {
    const n = nodeById.get(id);
    if (n) void selectNode(n, fly);
  };
  const search = async () => {
    const text = query.trim();
    if (text.length < 2) return;
    searchError = "";
    try {
      const res = await host.request("semanticSearch", { query: text, limit: 12, scope: S.scope });
      hits = res?.results || [];
      highlighted = new Set(hits.map((r) => r.id));
      searchError = res?.error || (hits.length ? "" : "No notes are close to that.");
      repaint();
      renderSide();
      if (hits[0]) selectById(hits[0].id, true);
    } catch (err) {
      hits = [];
      highlighted = /* @__PURE__ */ new Set();
      searchError = err instanceof Error ? err.message : "Search failed";
      repaint();
      renderSide();
    }
  };
  const clearSearch = () => {
    query = "";
    hits = [];
    highlighted = /* @__PURE__ */ new Set();
    searchError = "";
    const input = toolbarEl.querySelector('[data-bind="q"]');
    if (input) input.value = "";
    repaint();
    renderSide();
  };
  const setOrbit = (on) => {
    S.orbit = on;
    if (fg) fg.controls().autoRotate = on;
    persist();
    renderToolbar();
  };
  const stopOrbit = () => {
    setOrbit(false);
    if (fg) fg.cameraPosition(homeCamera(), { x: 0, y: 0, z: 0 }, 800);
  };
  const changeSpeed = (dir) => {
    const i = SPEED_STEPS.indexOf(S.speed);
    S.speed = SPEED_STEPS[Math.max(0, Math.min(SPEED_STEPS.length - 1, (i < 0 ? 2 : i) + dir))];
    if (fg) fg.controls().autoRotateSpeed = rotateSpeedFor(S.speed);
    persist();
    renderToolbar();
  };
  const startBuild = async () => {
    if (building) return;
    building = true;
    renderToolbar();
    renderMessage();
    try {
      const res = await host.request("semanticBuild");
      if (res?.error) {
        building = false;
        status = { ...status || { ready: false, building: false, build_line: null }, build_failed: res.error };
      }
    } catch (err) {
      building = false;
      status = { ...status || { ready: false, building: false, build_line: null }, build_failed: err instanceof Error ? err.message : "Could not start the build" };
    }
    renderToolbar();
    renderMessage();
    if (building) pollBuild();
  };
  const pollBuild = () => {
    if (pollTimer) clearTimeout(pollTimer);
    const tick = async () => {
      try {
        const s = await host.request("semanticStatus");
        status = s;
        if (!s.building) {
          building = false;
          if (s.ready && !s.build_failed) await loadGraph();
          renderToolbar();
          renderMessage();
          return;
        }
        building = true;
        renderToolbar();
        renderMessage();
      } catch {
      }
      pollTimer = setTimeout(tick, 2500);
    };
    pollTimer = setTimeout(tick, 1500);
  };
  const fmt = (iso) => iso ? new Date(iso).toLocaleString(void 0, { dateStyle: "medium", timeStyle: "short" }) : "";
  const chip = (label, attrs, active = false, extra = "") => `<button type="button" class="sg__chip${active ? " is-active" : ""}${extra}" ${attrs}>${label}</button>`;
  const renderToolbar = () => {
    const ready = !!graph;
    const buildLabel = building ? `Building\u2026 ${escapeHtml((status?.build_line || "").slice(0, 40))}` : status?.ready ? "Rebuild" : "Build";
    toolbarEl.innerHTML = `
    ${compact ? chip(`${icons.gear} Settings`, 'data-act="panel"', S.panel) : ""}
    ${compact ? chip(`${icons.layers} Legend`, 'data-act="legend"', S.legend) : ""}
    ${SCOPES.length ? `<span class="sg__label">Show</span>${SCOPES.map((x) => chip(escapeHtml(x.label), `data-scope="${escapeHtml(x.id)}"`, S.scope === x.id)).join("")}<span class="sg__sep"></span>` : ""}
    <span class="sg__label">Colour by</span>
    ${chip("Cluster", 'data-color="cluster"', S.colorBy === "cluster")}
    ${CATEGORIES.map((c) => chip(escapeHtml(c.label), `data-color="${escapeHtml(c.id)}"`, S.colorBy === c.id)).join("")}
    <span class="sg__sep"></span>
    ${chip("Links", 'data-act="links"', S.links)}
    ${chip("Cluster regions", 'data-act="hulls"', S.hulls)}
    <span class="sg__sep"></span>
    <span class="sg__label">Orbit</span>
    <div class="sg__transport" role="group" aria-label="Orbit">
      <button type="button" class="sg__tbtn${S.orbit ? " is-active" : ""}" data-act="orbit" title="${S.orbit ? "Pause" : "Play"}">${S.orbit ? icons.pause : icons.play}</button>
      <button type="button" class="sg__tbtn" data-act="stop" title="Stop and return to the start">${icons.stop}</button>
      <button type="button" class="sg__tbtn" data-act="slower" title="Slower"${S.speed <= SPEED_STEPS[0] ? " disabled" : ""}>${icons.minus}</button>
      <span class="sg__speed" title="One full turn every ${secondsPerTurn()} seconds">${S.speed}\xD7</span>
      <button type="button" class="sg__tbtn" data-act="faster" title="Faster"${S.speed >= SPEED_STEPS[SPEED_STEPS.length - 1] ? " disabled" : ""}>${icons.plus}</button>
    </div>
    ${compact ? "" : chip(`${icons.gear} Settings`, 'data-act="panel"', S.panel)}
    <span class="sg__spacer"></span>
    ${status?.ready ? `<span class="sg__stamp">Built ${escapeHtml(fmt(status.built_at))}${status.stale ? ' <span class="sg__stale">\xB7 notes changed since</span>' : ""}</span>` : ""}
    ${opts.allowBuild ? chip(buildLabel, `data-act="build"${building ? " disabled" : ""}`, false) : ""}
    <label class="sg__search">${icons.search}
      <input type="search" data-bind="q" value="${escapeHtml(query)}" placeholder="Search by meaning, then Return" autocapitalize="off" autocorrect="off" spellcheck="false"${ready ? "" : " disabled"}>
      ${query ? `<button type="button" data-act="clear" title="Clear">${icons.close}</button>` : ""}
    </label>`;
    positionPanels();
  };
  const positionPanels = () => {
    const top = toolbarEl.offsetTop + toolbarEl.offsetHeight + 8;
    legendEl.style.top = `${top}px`;
    sideEl.style.top = `${top}px`;
    panelEl.style.top = `${top}px`;
    sideEl.classList.toggle("is-beside", S.panel && !compact);
    if (compact) sideEl.style.visibility = S.panel ? "hidden" : "";
  };
  const renderLegend = () => {
    if (!graph || !S.legend) {
      legendEl.hidden = true;
      return;
    }
    legendEl.hidden = false;
    if (S.colorBy === "cluster") {
      legendEl.innerHTML = `<div class="sg__title">Clusters</div>` + graph.clusters.map((c) => `
      <div class="sg__lrow${focusCluster === c.id ? " is-focus" : ""}${focusCluster !== null && focusCluster !== c.id ? " is-dim" : ""}" data-cluster="${c.id}">
        <span class="sg__swatch" style="background:${clusterColor(c.id)}"></span>
        <span class="sg__llabel" title="${escapeHtml(c.label)}">${escapeHtml(c.label)}</span>
        <span class="sg__ln">${c.size}</span>
      </div>`).join("") + `<div class="sg__hint">Click a cluster to dim the others.</div>`;
    } else {
      const cat = catById(S.colorBy);
      if (!cat) {
        legendEl.hidden = true;
        return;
      }
      const counts = /* @__PURE__ */ new Map();
      for (const n of graph.nodes) {
        const v = catValue(n, cat);
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      const values = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      legendEl.innerHTML = `<div class="sg__title">${escapeHtml(cat.label)}</div>` + values.map(([v, n]) => `
      <div class="sg__lrow${focusValue === v ? " is-focus" : ""}${focusValue !== null && focusValue !== v ? " is-dim" : ""}" data-value="${escapeHtml(v)}">
        <span class="sg__swatch" style="background:${catColor(cat, v)}"></span>
        <span class="sg__llabel">${escapeHtml(catLabel(cat, v))}</span>
        <span class="sg__ln">${n}</span>
      </div>`).join("") + `<div class="sg__hint">Click one to dim the others.</div>`;
    }
  };
  const hitRow = (h, kind = true) => `
  <div class="sg__hit${selected?.id === h.id ? " is-active" : ""}" data-hit="${escapeHtml(h.id)}">
    <span class="sg__score">${Math.round(h.score * 100)}%</span>
    <span class="sg__hlabel" title="${escapeHtml(h.label)}">${escapeHtml(h.label)}</span>
    ${kind && CATEGORIES[0] && nodeById.get(h.id) ? `<span class="sg__hkind">${escapeHtml(catLabel(CATEGORIES[0], catValue(nodeById.get(h.id), CATEGORIES[0])))}</span>` : ""}
  </div>`;
  const renderSide = () => {
    if (!hits.length && !selected && !searchError) {
      sideEl.hidden = true;
      return;
    }
    sideEl.hidden = false;
    let html = "";
    if (hits.length || searchError) {
      html += `<div class="sg__title">Closest notes <button type="button" data-act="clear">Clear</button></div>`;
      if (searchError) html += `<div class="sg__error">${escapeHtml(searchError)}</div>`;
      html += hits.map((h) => hitRow(h)).join("");
    }
    if (selected) {
      const n = selected;
      html += `<div class="sg__title${hits.length ? " sg__title--sub" : ""}">Selected</div>
      <div class="sg__sel">${escapeHtml(n.label)}</div>
      <div class="sg__meta">
        ${CATEGORIES.filter((c) => catValue(n, c)).map((c) => `<span class="sg__tag" style="border-color:${catColor(c, catValue(n, c))}" title="${escapeHtml(c.label)}">${escapeHtml(catLabel(c, catValue(n, c)))}</span>`).join("")}
        <span class="sg__tag" style="border-color:${clusterColor(n.cluster)}">${escapeHtml(clusterLabel(n.cluster))}</span>
        ${n.tags.slice(0, 6).map((t) => `<span class="sg__tag">#${escapeHtml(t)}</span>`).join("")}
      </div>
      <button type="button" class="sg__open" data-act="open">${icons.open} Open note</button>
      <div class="sg__title sg__title--sub">Closest in meaning</div>
      ${neighbors.length ? neighbors.map((h) => hitRow(h, false)).join("") : '<div class="sg__hint">Looking\u2026</div>'}`;
    }
    sideEl.innerHTML = html;
  };
  const renderMessage = () => {
    if (graph) {
      msgEl.hidden = true;
      return;
    }
    msgEl.hidden = false;
    if (building) {
      msgEl.innerHTML = `<div>Building the semantic layout\u2026</div><div class="sg__hint">${escapeHtml(status?.build_line || "starting")}</div>`;
    } else if (status?.build_failed) {
      msgEl.innerHTML = `<div>The last build failed.</div><div class="sg__error">${escapeHtml(status.build_failed)}</div>` + (opts.allowBuild ? `<button type="button" class="sg__chip sg__primary" data-act="build">Try again</button>` : "");
    } else if (status && !status.ready) {
      msgEl.innerHTML = `<div>The semantic layout has not been built yet.</div>` + (opts.allowBuild ? `<div class="sg__hint">${escapeHtml(opts.buildIntro)}</div>
         <button type="button" class="sg__chip sg__primary" data-act="build">Build it now</button>` : `<div class="sg__hint">${escapeHtml(opts.buildHint)}</div>`);
    } else {
      msgEl.textContent = "Loading the semantic graph\u2026";
    }
  };
  const loadGraph = async () => {
    const g = initialData && initialData.ready ? initialData : await host.request("semanticGraph", { scope: S.scope });
    initialData = void 0;
    if (destroyed) return;
    if (!g || !g.ready || !g.nodes.length) {
      graph = null;
      return;
    }
    graph = g;
    indexCategories();
    nodeById.clear();
    for (const n of g.nodes) nodeById.set(n.id, n);
    selected = null;
    neighbors = [];
    hits = [];
    highlighted = /* @__PURE__ */ new Set();
    focusCluster = null;
    focusValue = null;
    hudEl.textContent = hudText(g.nodes.length, g.links.length);
    ensureGraph();
    render();
    renderLegend();
    renderSide();
    host.notify?.("ready", { nodes: g.nodes.length, links: g.links.length });
  };
  const section = (id, title, body, tools = "") => `
<section class="sg__sec${S.open[id] ? "" : " is-closed"}" data-sec="${id}">
  <header class="sg__sec-h">
    <button type="button" class="sg__sec-t" data-toggle="${id}">${S.open[id] ? icons.chevronDown : icons.chevronRight}${title}</button>
    ${tools}
  </header>
  <div class="sg__sec-b">${body}</div>
</section>`;
  const toggleRow = (label, key, on) => `
<label class="sg__row"><span>${label}</span><span class="sg__switch"><input type="checkbox" data-switch="${key}"${on ? " checked" : ""}><span></span></span></label>`;
  const sliderRow = (label, key, min, max, step) => `
<label class="sg__slider"><span>${label}</span><input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${S.display[key]}"></label>`;
  const groupRows = () => S.groups.map((g, i) => `
<div class="sg__group">
  <input type="text" class="sg__group-q" data-group-q="${i}" value="${escapeHtml(g.query)}" placeholder="path:concepts, cluster:name \u2026" spellcheck="false" autocapitalize="off" autocorrect="off">
  <label class="sg__gswatch" style="background:${escapeHtml(g.color)}" title="Colour"><input type="color" data-group-c="${i}" value="${escapeHtml(g.color)}"></label>
  <button type="button" class="sg__x" data-group-x="${i}" title="Remove group">${icons.close}</button>
</div>`).join("") + `<button type="button" class="sg__new" data-pact="new-group">New group</button>`;
  const renderPanel = () => {
    panelEl.hidden = !S.panel;
    positionPanels();
    if (!S.panel) return;
    panelEl.innerHTML = section(
      "filters",
      "Filters",
      `
      <label class="sg__psearch">${icons.search}
        <input type="text" data-bind="filter" value="${escapeHtml(filterText)}" placeholder="Show only matching notes\u2026" spellcheck="false" autocapitalize="off" autocorrect="off">
      </label>
      <div class="sg__hint">path:folder &nbsp; file:name &nbsp; tag:name &nbsp; folder:stories &nbsp; cluster:name &nbsp; -not</div>`,
      `<span class="sg__sec-tools">
        <button type="button" data-pact="reset" title="Restore default settings">${icons.reset}</button>
        <button type="button" data-pact="close" title="Close">${icons.close}</button>
      </span>`
    ) + section("groups", "Groups", `<div class="sg__hint">A group colours the notes it matches, over the cluster or folder colour. The first match wins.</div><div data-groups class="sg__groups">${groupRows()}</div>`) + section(
      "display",
      "Display",
      sliderRow("Node size", "nodeSize", 0.2, 4, 0.1) + sliderRow("Spread", "spread", 0.4, 2.5, 0.05) + sliderRow("Link thickness", "linkThickness", 0, 4, 0.1) + sliderRow("Link opacity", "linkOpacity", 0.05, 1, 0.05) + sliderRow("Particle size", "particleSize", 0.5, 6, 0.1) + sliderRow("Particle count", "particleCount", 0, 10, 1) + sliderRow("Cluster region opacity", "regionOpacity", 0, 0.3, 0.01) + toggleRow("Name labels", "labels", S.display.labels)
    );
  };
  const renderGroups = () => {
    const el = panelEl.querySelector("[data-groups]");
    if (el) el.innerHTML = groupRows();
  };
  const regroup = () => {
    compileGroups();
    repaint();
    renderSide();
  };
  let filterTimer = null;
  panelEl.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle],[data-pact],[data-group-x]");
    if (!t) return;
    if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      S.open[id] = !S.open[id];
      panelEl.querySelector(`[data-sec="${id}"]`)?.classList.toggle("is-closed", !S.open[id]);
      t.innerHTML = (S.open[id] ? icons.chevronDown : icons.chevronRight) + escapeHtml(t.textContent || "");
      persist();
      return;
    }
    if (t.dataset.groupX != null) {
      S.groups.splice(Number(t.dataset.groupX), 1);
      renderGroups();
      regroup();
      persist();
      return;
    }
    switch (t.dataset.pact) {
      case "close":
        S.panel = false;
        persist();
        renderToolbar();
        renderPanel();
        break;
      case "new-group":
        S.groups.push({ query: "", color: NEW_GROUP_COLORS[S.groups.length % NEW_GROUP_COLORS.length] });
        renderGroups();
        persist();
        panelEl.querySelector(`[data-group-q="${S.groups.length - 1}"]`)?.focus();
        break;
      case "reset": {
        const d = defaults();
        S.groups = d.groups;
        S.display = d.display;
        filterText = "";
        S.filter = "";
        compileGroups();
        resizeNodes();
        applySpread();
        applyFilter();
        if (fg) fg.linkOpacity(S.display.linkOpacity).linkDirectionalParticleWidth(S.display.particleSize);
        renderPanel();
        persist();
        break;
      }
    }
  });
  panelEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.bind === "filter") {
      filterText = t.value;
      S.filter = t.value;
      persist();
      if (filterTimer) clearTimeout(filterTimer);
      filterTimer = setTimeout(() => applyFilter(), 200);
      return;
    }
    if (t.dataset.groupQ != null) {
      S.groups[Number(t.dataset.groupQ)].query = t.value;
      regroup();
      persist();
      return;
    }
    if (t.dataset.groupC != null) {
      S.groups[Number(t.dataset.groupC)].color = t.value;
      t.parentElement.style.background = t.value;
      regroup();
      persist();
      return;
    }
    const key = t.dataset.range;
    if (!key) return;
    S.display[key] = Number(t.value);
    if (key === "nodeSize") resizeNodes();
    else if (key === "spread") applySpread();
    else if (key === "linkOpacity") fg?.linkOpacity(S.display.linkOpacity);
    else if (key === "particleSize") fg?.linkDirectionalParticleWidth(S.display.particleSize);
    else if (key === "regionOpacity") drawHulls();
    else light();
    persist();
  });
  panelEl.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.switch === "labels") {
      S.display.labels = t.checked;
      labelLit();
      persist();
    }
  });
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act],[data-color],[data-scope],[data-cluster],[data-value],[data-hit]");
    if (!t) return;
    if (t.dataset.scope) {
      if (t.dataset.scope === S.scope) return;
      S.scope = t.dataset.scope;
      persist();
      renderToolbar();
      void loadGraph().then(() => {
        renderToolbar();
        renderMessage();
      }).catch(fail);
      return;
    }
    if (t.dataset.color) {
      S.colorBy = t.dataset.color;
      focusCluster = null;
      focusValue = null;
      persist();
      repaint();
      drawHulls();
      renderToolbar();
      renderLegend();
      return;
    }
    if (t.dataset.cluster != null) {
      const id = Number(t.dataset.cluster);
      focusCluster = focusCluster === id ? null : id;
      repaint();
      renderLegend();
      return;
    }
    if (t.dataset.value != null) {
      focusValue = focusValue === t.dataset.value ? null : t.dataset.value;
      repaint();
      renderLegend();
      return;
    }
    if (t.dataset.hit) {
      selectById(t.dataset.hit, true);
      const n = nodeById.get(t.dataset.hit);
      if (n && host.platform !== "ios") openNote(n);
      return;
    }
    switch (t.dataset.act) {
      case "links":
        S.links = !S.links;
        applyFilter();
        persist();
        renderToolbar();
        break;
      case "hulls":
        S.hulls = !S.hulls;
        drawHulls();
        persist();
        renderToolbar();
        break;
      case "legend":
        S.legend = !S.legend;
        persist();
        renderToolbar();
        renderLegend();
        break;
      case "panel":
        S.panel = !S.panel;
        persist();
        renderToolbar();
        renderPanel();
        break;
      case "orbit":
        setOrbit(!S.orbit);
        break;
      case "stop":
        stopOrbit();
        break;
      case "slower":
        changeSpeed(-1);
        break;
      case "faster":
        changeSpeed(1);
        break;
      case "clear":
        clearSearch();
        renderToolbar();
        break;
      case "build":
        void startBuild();
        break;
      case "open":
        if (selected) openNote(selected);
        break;
    }
  });
  toolbarEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.bind === "q") query = t.value;
  });
  toolbarEl.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.dataset?.bind !== "q") return;
    if (e.key === "Enter") {
      e.preventDefault();
      t.blur();
      void search();
    } else if (e.key === "Escape") {
      clearSearch();
      renderToolbar();
    }
  });
  toolbarEl.addEventListener("search", (e) => {
    const t = e.target;
    if (t.dataset?.bind === "q" && !t.value && (hits.length || searchError)) clearSearch();
  });
  const toolbarObserver = new ResizeObserver(() => positionPanels());
  toolbarObserver.observe(toolbarEl);
  const start = async () => {
    renderToolbar();
    renderPanel();
    renderMessage();
    try {
      if (!status) status = await host.request("semanticStatus");
      building = !!status?.building;
      if (status?.ready) await loadGraph();
      renderToolbar();
      renderMessage();
      if (building) pollBuild();
    } catch (err) {
      fail(err);
    }
  };
  const fail = (err) => {
    if (destroyed) return;
    msgEl.hidden = false;
    msgEl.textContent = "Could not load the semantic graph.";
    host.notify?.("failed", { message: err instanceof Error ? err.message : "unknown" });
  };
  const openNote = (n) => host.open({ id: n.id, note: n.id, title: n.label, quote: "", path: n.path, raw: n });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(entryFrame);
    for (const t of [entryTimer, pollTimer, filterTimer]) if (t) clearTimeout(t);
    toolbarObserver.disconnect();
    canvasObserver?.disconnect();
    if (fg) {
      fg.pauseAnimation?.();
      fg._destructor?.();
      fg = null;
    }
    app.innerHTML = "";
  };
  const page = { destroy };
  start();
  return page;
}

// src/host-helpers.ts
var memory = () => {
  const m = /* @__PURE__ */ new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => {
    m.set(k, v);
  } };
};
var local = () => ({
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
    }
  }
});
var fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
};
function createHost(opts = {}) {
  const store = opts.storage === "memory" ? memory() : opts.storage && typeof opts.storage === "object" ? opts.storage : local();
  const prefix = opts.storagePrefix || "";
  const cache = /* @__PURE__ */ new Map();
  const loadGraph = (id) => {
    if (!cache.has(id)) {
      const input = opts.graphs?.[id];
      const p = !input ? Promise.reject(new Error(`No graph for source "${id}"`)) : typeof input === "string" ? fetchJson(input) : typeof input === "function" ? input() : Promise.resolve(input);
      cache.set(id, p.catch((err) => {
        cache.delete(id);
        throw err;
      }));
    }
    return cache.get(id);
  };
  const sem = () => {
    if (!opts.semantic) throw new Error("No semantic data: pass createHost({ semantic })");
    return opts.semantic;
  };
  return {
    platform: opts.platform || "web",
    compact: opts.compact ?? (typeof window !== "undefined" && window.innerWidth < 700),
    accent: opts.accent,
    debug: opts.debug,
    async request(type, p = {}) {
      const scope = typeof p.scope === "string" ? p.scope : void 0;
      switch (type) {
        case "graph":
          return await loadGraph(String(p.source));
        case "semanticStatus":
          return await sem().status();
        case "semanticGraph":
          return await sem().graph(scope);
        case "semanticSearch": {
          const s = sem();
          if (!s.search) return { results: [], error: "Search is not available for this graph." };
          return await s.search(String(p.query || ""), Number(p.limit) || 12, scope);
        }
        case "semanticNeighbors": {
          const s = sem();
          return s.neighbors ? await s.neighbors(String(p.id), Number(p.limit) || 8) : { results: [] };
        }
        case "semanticBuild": {
          const s = sem();
          return s.build ? await s.build() : { error: "This graph cannot be rebuilt here." };
        }
        default:
          throw new Error(`Unknown request "${type}"`);
      }
    },
    open: (t) => opts.onOpen?.(t),
    loadSetting: (key) => store.get(prefix + key),
    saveSetting: (key, value) => store.set(prefix + key, JSON.stringify(value)),
    notify: opts.onNotify
  };
}
function createStaticSemantic(source, opts = {}) {
  let loaded = null;
  let vecs = null;
  let dims = 0;
  const index = /* @__PURE__ */ new Map();
  const load = () => loaded || (loaded = (typeof source === "string" ? fetchJson(source) : Promise.resolve(source)).then((d) => {
    d.nodes.forEach((n, i) => index.set(n.id, i));
    if (d.vectors?.encoding === "int8-base64" && d.vectors.data) {
      const bin = atob(d.vectors.data);
      vecs = new Int8Array(bin.length);
      for (let i = 0; i < bin.length; i++) vecs[i] = bin.charCodeAt(i) << 24 >> 24;
      dims = d.vectors.dims;
    }
    return d;
  }));
  const inScope = (d, scope) => {
    const rule = scope ? opts.scopes?.[scope] : void 0;
    return rule ? new Set(d.nodes.filter(rule).map((n) => n.id)) : null;
  };
  const dot = (i, q) => {
    let s = 0;
    const o = i * dims;
    for (let k = 0; k < dims; k++) s += vecs[o + k] * q[k];
    return s;
  };
  const norm = (v) => {
    let s = 0;
    for (let k = 0; k < v.length; k++) s += v[k] * v[k];
    return Math.sqrt(s) || 1;
  };
  const rowNorms = /* @__PURE__ */ new Map();
  const rowNorm = (i) => {
    let n = rowNorms.get(i);
    if (n == null) {
      n = norm(vecs.subarray(i * dims, (i + 1) * dims));
      rowNorms.set(i, n);
    }
    return n;
  };
  const rank = (d, q, limit, keep, skip) => {
    const qn = norm(q);
    const scored = [];
    d.nodes.forEach((n, i) => {
      if (n.id === skip || keep && !keep.has(n.id)) return;
      scored.push({ id: n.id, label: n.label, score: dot(i, q) / (rowNorm(i) * qn) });
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  };
  return {
    async status() {
      const d = await load();
      return { ready: true, building: false, build_line: null, build_failed: null, built_at: d.built_at, n_notes: d.nodes.length, n_clusters: d.clusters.length, n_links: d.links.length };
    },
    async graph(scope) {
      const d = await load();
      const keep = inScope(d, scope);
      if (!keep) return { ...d, ready: true };
      const nodes = d.nodes.filter((n) => keep.has(n.id));
      const sizes = /* @__PURE__ */ new Map();
      for (const n of nodes) sizes.set(n.cluster, (sizes.get(n.cluster) || 0) + 1);
      return {
        ...d,
        ready: true,
        nodes,
        clusters: d.clusters.filter((c) => sizes.has(c.id)).map((c) => ({ ...c, size: sizes.get(c.id) })),
        links: d.links.filter((l) => keep.has(l.source) && keep.has(l.target))
      };
    },
    async search(query, limit, scope) {
      const d = await load();
      const keep = inScope(d, scope);
      if (!vecs) return { results: [], error: "This dataset has no vectors to search." };
      if (opts.embed) return { results: rank(d, await opts.embed(query), limit, keep) };
      const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
      const scoreText = (n) => {
        const title = n.label.toLowerCase();
        const rest = `${(n.tags || []).join(" ")} ${n.path || n.id}`.toLowerCase();
        return words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (rest.includes(w) ? 1 : 0), 0);
      };
      const seeds = d.nodes.map((n, i) => ({ i, s: scoreText(n) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
      if (!seeds.length) return { results: [], error: "No notes use those words." };
      const q = new Float32Array(dims);
      for (const { i } of seeds) {
        const r = rowNorm(i);
        for (let k = 0; k < dims; k++) q[k] += vecs[i * dims + k] / r;
      }
      return { results: rank(d, q, limit, keep) };
    },
    async neighbors(id, limit) {
      const d = await load();
      const i = index.get(id);
      if (i == null || !vecs) return { results: [] };
      return { results: rank(d, vecs.subarray(i * dims, (i + 1) * dims), limit, null, id) };
    }
  };
}

// src/wrappers.ts
function mountGraph(kind, el, props, onOpen, onNotify) {
  const host = props.host || createHost({
    graphs: props.graphs,
    semantic: props.semantic,
    storage: props.storage,
    storagePrefix: props.storagePrefix,
    accent: props.accent,
    compact: props.compact,
    debug: props.debug,
    onOpen,
    onNotify
  });
  if (kind === "semantic") {
    const p2 = props;
    return mountSemantic(el, host, {
      settingsKey: p2.settingsKey || "kg.semantic.settings",
      categories: p2.categories || [],
      scopes: p2.scopes,
      defaultScope: p2.defaultScope,
      allowBuild: !!p2.allowBuild,
      buildIntro: p2.buildIntro || "Build the semantic layout, then reload.",
      buildHint: p2.buildHint || "The semantic layout has not been built yet."
    });
  }
  const p = props;
  return kind === "2d" ? mountKnowledge(el, host, { sources: p.sources, sourceKey: p.sourceKey || "kg.2d.source", initialSource: p.initialSource }) : mount3D(el, host, { sources: p.sources, settingsKey: p.settingsKey || "kg.3d.settings" });
}
var BOX_STYLE = { position: "relative", width: "100%", height: "100%", minHeight: "320px", overflow: "hidden" };
export {
  BOX_STYLE,
  createHost,
  createStaticSemantic,
  mount3D,
  mountGraph,
  mountKnowledge,
  mountSemantic
};
