# CLAUDE.md

- Adding these graphs to an app: follow [AGENTS.md](AGENTS.md).
- Working on this package itself:
  - Source is in `src/`: the three pages in `knowledge/`, `force3d/` and `semantic/`; `host.ts` and `host-helpers.ts`; the React, Vue and standalone entries.
  - Build with `npm run build` and commit `dist/`: people install straight from GitHub, and CI fails if it is stale. Check with `npm run typecheck && npm test && npm run test:e2e`.
  - The sample data is generated: change `sample-data/generate.mjs` and run `npm run sample-data`, never edit the output by hand. The semantic layout needs Ollama: `npm run sample-data:semantic`.
  - Keep every file free of real people's data; the sample archive is fiction on purpose.
  - Keep the copyright line `Copyright (c) 2026 Hung Ngo` and the build banner.
