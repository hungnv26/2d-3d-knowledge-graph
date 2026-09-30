# The Meridian Archive

The sample data: the recovered knowledge vault of the survey starship *Meridian*, a fictional deep-space expedition (2187–2194). Every note, name and event is invented by `generate.mjs`, from a fixed seed, so it is the same every time you generate it.

| Folder | Notes | What's in it |
|---|---|---|
| `worlds/` | 116 | planets, moons and stations, such as *Kepler's Lantern*, *The Glass Tides of Oru* and *The Silent Cluster* |
| `species/` | 92 | xenobiology, such as the *Choir Moss* and the *Vell Drifters* |
| `tech/` | 120 | the fold drive, graviton looms, memory crystals… |
| `crew/` | 70 | officers, scientists, and the ship's intelligence *ORRERY* |
| `missions/` | 142 | surveys and rescues with a status (succeeded, failed, active, planned, lost) and a year |
| `logs/` | 84 | captain's logs, watch logs, incident reports, and the eight-part *The Long Silence* |
| `maps/` | 18 | topic maps: the hubs, such as *Atlas of the Outer Reach* and *Bestiary of Oru* |
| (root) | 25 | unfiled fragments with no links: the orphans |

It is built to show every feature:

| What it has | Where it shows |
|---|---|
| Hubs with 40–130 links | the maps and ORRERY |
| About 110 notes hanging off a single map | Hubs mode rings |
| 60 tags, some nested (`biome/ocean/abyssal`) | tag filters and tag nodes |
| 25 orphans | the Orphans filter |
| A long chain (*The Long Silence*, parts I–VIII) | the local graph at depth 4 |
| An island that links only to itself (*The Silent Cluster*) | a separate island in every view |

## Files

| File | Made by | Used by |
|---|---|---|
| `meridian/notes/**.md` | `generate.mjs` | everything below |
| `meridian/graphify-out/graph.json` | `generate.mjs`, in Graphify's own output format | `kg-graphify` |
| `meridian/links.json` | `kg-links` | the Links source |
| `meridian/graphify.json` | `kg-graphify` | the Graphify source: 2,948 nodes (notes, concepts, rationales, papers), 60 communities, about 680 inferred links |
| `meridian/semantic.json` | `tools/semantic/build.py` (bge-m3 via Ollama) | the 3D Semantic Graph: 18 clusters, with vectors for in-browser search |

## Regenerate

```bash
npm run sample-data            # notes, graphify-out, links.json, graphify.json
npm run sample-data:semantic   # semantic.json (needs Ollama with bge-m3, about 2 minutes)
```
