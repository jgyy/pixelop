# 玉莲飞升 · Jade Lotus Ascension

A **2.5D isometric pixel-art xianxia RPG** built as a full-stack **Next.js 16** web app. You play **Lin Yue**, an inner disciple of the Azure Cloud Sect. Her journey runs from the floating sect, down to a mortal village, through a haunted bamboo forest and a moonlit lotus lake, into the Crimson Demon Valley to reclaim the stolen Jade Lotus Heart, and finally up to Heavenly Tribulation Peak, where she rises from *Qi Condensation* to *Immortal Ascension*.

**Every pixel is generated procedurally in TypeScript.** The repo contains no image assets for the game. A small z-buffered ray caster draws characters, beasts, trees and buildings from 3D primitives, which gives every character **16 facing directions** for free. A texture painter draws the isometric terrain. The same code runs in the browser, in Node (PNG/GIF export) and in unit tests. The game fills **100% of the screen** at an integer pixel scale.

![Title screen](docs/screenshots/00-title.png)

| | |
|---|---|
| ![Opening narration](docs/screenshots/01-opening.png) | ![Intro cutscene](docs/screenshots/02-intro-cutscene.png) |
| ![Elder Mo's briefing](docs/screenshots/03-elder-dialogue.png) | ![Sword flight over the sect](docs/screenshots/04-sect-sword-flight.png) |
| ![World map](docs/screenshots/05-world-map.png) | ![Willow Creek Village](docs/screenshots/06-village.png) |
| ![Hu Li in the bamboo forest](docs/screenshots/07-bamboo-fox-maiden.png) | ![Myriad Swords Return](docs/screenshots/08-battle-myriad-swords.png) |
| ![Moonlit Lotus Lake](docs/screenshots/09-moonlit-lake.png) | ![Meditation](docs/screenshots/10-meditation.png) |
| ![Heavenly tribulation](docs/screenshots/11-heavenly-tribulation.png) | ![Crimson Demon Valley](docs/screenshots/12-demon-valley.png) |
| ![Boss battle with Patriarch Xue](docs/screenshots/13-boss-battle.png) | ![Heavenly Tribulation Peak](docs/screenshots/14-tribulation-peak.png) |

### Animated art

| Lin Yue's 11 animations | All 16 facing directions |
|---|---|
| ![Heroine move set](docs/art/heroine-moves.gif) | ![Heroine 16 directions](docs/art/heroine-16dir.gif) |

| The cast (turning on the spot) | Bestiary |
|---|---|
| ![Cast](docs/art/cast.gif) | ![Bestiary](docs/art/bestiary.gif) |

| Azure Cloud Sect | Willow Creek Village | Whispering Bamboo Forest |
|---|---|---|
| ![](docs/art/area-sect.gif) | ![](docs/art/area-village.gif) | ![](docs/art/area-bamboo.gif) |

| Moonlit Lotus Lake | Crimson Demon Valley | Heavenly Tribulation Peak |
|---|---|---|
| ![](docs/art/area-lake.gif) | ![](docs/art/area-valley.gif) | ![](docs/art/area-peak.gif) |

| World map | Dialogue portraits |
|---|---|
| ![World map](docs/art/worldmap.gif) | ![Portraits](docs/art/portraits.png) |

![World props](docs/art/props.gif)

## Features

- **2.5D isometric world:** height-mapped tile maps with cliffs, stairs, raised platforms, floating islands with rocky undersides, animated water and lava with shore foam, depth-sorted props (sliced into screen columns so they occlude correctly), contact shadows, an x-ray silhouette when the heroine walks behind something, and parallax skies.
- **Procedural 3D pixel sprites:** 15 humanoid characters and 6 beasts, each built from roughly 20 ray-cast solids (bell skirts, sleeves, hair strands, shawls, tails, hats, weapons) with hue-shifted 4-tone shading, face decals and selective outlines. They render in 16 directions with up to 11 animations: idle, walk, talk, attack, cast, hurt, meditate, sword-flight, victory, defeat and bow, plus hop, practice and fishing. Dialogue portraits are rendered from the same models at 3× scale, with blink and talk frames.
- **38 props, most of them animated:** swaying pines, cherry and maple trees, bamboo groves, willows, a glowing spirit tree, the multi-tier Hall of Clouds, village houses with chimney smoke, a lake pavilion, flickering lanterns and braziers that cast soft glows at night, waving banners, a bubbling alchemy cauldron, bobbing lotuses and boats, a rotating taiji dais, a pulsing blood altar, and more.
- **Six regions plus a world map:** the floating Azure Cloud Sect (day, falling petals), Willow Creek Village (dusk, autumn leaves), the Whispering Bamboo Forest (fireflies), the Moonlit Lotus Lake (night, stars and moon), the Crimson Demon Valley (blood moon, embers, lava) and Heavenly Tribulation Peak (snow, storm lightning). The miniature isometric continent has roads, rivers, sea, drifting clouds and their shadows, and animated landmarks. Regions unlock as the story advances.
- **Narrative:** a prologue, five chapters and an epilogue, with a quest tracker, scripted cutscenes (walk, emote, camera, flash, shake, spawn), typed-out dialogue with animated portraits, full-screen narration, first-arrival scenes, pre-boss speeches and an ending.
- **Cultivation:** 6 realms × 4 stages. Battles, spirit herbs, chests and shrine meditation grow your cultivation. At a realm's peak you must survive a Heavenly Tribulation (3 bolts, or 9 for the final ascension).
- **Turn-based battles** on themed isometric arenas, with five techniques (Azure Sword Strike, Jade Lotus Palm, Lotus Heart Sutra, Myriad Swords Return, Nine Heavens Thunder), pills and fleeing. Fighters dash in, recoil, throw qi orbs and foxfire, and call down lightning, with damage pop-ups, crits, screen shake and flashes.
- **Controls:** keyboard, click/tap-to-walk, and a virtual joystick on touch screens.
- **Full stack:** saves are validated with zod and stored server-side by Route Handlers in an atomic JSON file store. A leaderboard of top cultivators is computed from all saves. The gallery at `/gallery` plays every character, prop and region live.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` · `npm run typecheck` | ESLint (next core-web-vitals + TS) · `tsc --noEmit` |
| `npm test` | Vitest unit tests (ray caster, art, areas, story, engine, runtime, API) |
| `npm run test:e2e` | Playwright end-to-end tests (needs `npm run build` first; set `PW_CHROMIUM` to use a local Chromium) |
| `npm run screenshots` | Re-captures `docs/screenshots/*` through Playwright |
| `npm run assets` | Exports the animated GIF showcases and PNGs to `docs/art/` |

Saves live in `$DATA_DIR/saves.json` (default `.data/`). Set `SAVE_STORE=memory` for an ephemeral in-memory store.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows (or click / tap a tile) | Walk (screen-relative) |
| `F` | Ride the flying sword (faster, crosses water, enemies can't reach you) |
| `E` / `Space` / `Enter` | Talk · meditate at shrines · open chests · gather herbs · read steles · open the world map at a region's gate |
| `M` | World map (arrows fly along roads, `E` lands) |
| `B` | Face the Heavenly Tribulation (while meditating at a bottleneck) |
| `H` / `Q` | Swallow a healing / qi pill |
| `1`–`5` | Battle techniques · `6` `7` pills · `0` flee |
| `Esc` | Skip a cutscene |

## Story

```mermaid
flowchart TD
  P["Prologue · The Stolen Heart<br/>Elder Mo sends Lin Yue after the Blood Moon Sect"] --> C1
  C1["Chapter I · Trouble Below the Clouds<br/>Drive off the fox haunting Willow Creek, hear Head Zhou's tale"] --> C2
  C2["Chapter II · Whispers in the Bamboo<br/>Calm 3 maddened fox spirits, meet Hu Li the fox maiden"] --> C3
  C3["Chapter III · The Moonlit Lake<br/>Find Old Fisher Wen, subdue the Serpent King,<br/>learn Myriad Swords Return"] --> C4
  C4["Chapter IV · Heaven's Gate<br/>Survive the tribulation into Foundation Establishment"] --> C5
  C5["Chapter V · The Blood Moon<br/>Defeat Patriarch Xue, reclaim the Jade Lotus Heart"] --> E
  E["Epilogue · Ascension<br/>Return the Heart, climb Tribulation Peak,<br/>endure nine bolts and ascend"]
  classDef c fill:#241a40,stroke:#3fb59a,color:#fff6dc;
  class P,C1,C2,C3,C4,C5,E c;
```

### World map gating

```mermaid
flowchart LR
  sect["青云宗 Azure Cloud Sect"] -- "met Elder Mo" --> village["柳溪村 Willow Creek"]
  village -- "Head Zhou's request" --> bamboo["竹林 Bamboo Forest"]
  village -- "Hu Li's charm + Qi Late" --> lake["月莲湖 Lotus Lake"]
  lake --- bamboo
  bamboo -- "Serpent King + Foundation" --> valley["血魔谷 Demon Valley"]
  sect -- "Heart returned" --> peak["天劫峰 Tribulation Peak"]
```

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI["React UI (fullscreen overlay)<br/>HUD · quest · dialogue + portraits ·<br/>world map · battle · shop · touch joystick"]
    RT["Game runtime<br/>runtime/Game.ts"]
    CS["CanvasSurface<br/>viewport-sized canvas,<br/>integer pixel scale"]
    UI -- "input & actions" --> RT
    RT -- "UiSnapshot" --> UI
    RT -- "render(surface)" --> CS
  end

  subgraph Pure["Pure TypeScript (browser, Node & tests)"]
    SC["Scenes<br/>World (iso area) · WorldMap · BattleScene"]
    ST["Story<br/>quests · dialogue · cutscene scripts"]
    ENG["Engine<br/>realms · battle · enemies · state (zod)"]
    ART["Pixel art<br/>ray caster · characters · props ·<br/>tiles · skies"]
    WD["World data<br/>areas · tile maps · overworld"]
  end

  subgraph Server["Next.js Route Handlers"]
    SAVE["/api/save/[playerId]<br/>GET · PUT · DELETE"]
    LB["/api/leaderboard"]
    HL["/api/health"]
    STORE[("FileSaveStore<br/>.data/saves.json")]
    SAVE --> STORE
    LB --> STORE
  end

  RT --> SC
  RT --> ST
  SC --> ENG
  SC --> ART
  SC --> WD
  UI -- "fetch (JSON)" --> SAVE
  UI -- fetch --> LB
  EXP["scripts/export-assets.ts"] --> ART
  EXP --> GIF["docs/art/*.gif · *.png"]
```

### Game modes

```mermaid
stateDiagram-v2
  [*] --> Title
  Title --> Scene: Begin Cultivation (opening narration)
  Title --> Explore: Continue
  Scene --> Explore: script ends / Esc skips
  Explore --> Scene: talk to NPC · read stele · first arrival
  Scene --> Shop: Senior Sister Qing
  Shop --> Scene
  Explore --> WorldMap: E at a gate / M
  WorldMap --> Explore: land (E)
  Explore --> Scene: touch a boss (speech)
  Scene --> Battle
  Explore --> Battle: touch a demonic beast
  Battle --> Scene: victory (story consequences)
  Battle --> Explore: flee / defeat (wake at sect shrine)
  Explore --> Meditate: E at a shrine
  Meditate --> Tribulation: B at a bottleneck
  Tribulation --> Explore: breakthrough
  Tribulation --> Scene: final ascension (ending)
```

### How a sprite is made

```mermaid
flowchart TB
  P["Pose (per frame)<br/>feet · hands · lean · bob · wind ·<br/>eyes · mouth · sword"] --> R
  S["Style<br/>palettes · hair · hat · beard ·<br/>cape · tails · weapon · scale"] --> R
  R["Rig: ~20 solids in model space<br/>spheres · ellipsoids · sphere-swept splines ·<br/>convex boxes / prisms / cones"] --> F
  F["Facing basis (16 directions)<br/>model → camera (h, d, z)"] --> X
  X["Per-pixel ray cast through a 30° iso camera<br/>z-buffer · Lambert light → 4-tone hue-shifted ramp ·<br/>per-material shaders (hems, collars, scales, roof tiles)"] --> D
  D["Decals: eyes · mouth · blush<br/>(visible only when facing the camera)"] --> O
  O["Selective outline<br/>inner lines where parts overlap + silhouette"] --> B["PixelBuffer frame (cached lazily)"]
  B --> B1["Browser: cached canvas → drawImage"]
  B --> B2["Node: GIF / PNG export"]
  B --> B3["Vitest: determinism & coverage"]
```

### Isometric renderer

```mermaid
flowchart LR
  T["Tile columns<br/>(textured top + cliff walls,<br/>painted once per area)"] --> K
  PR["Props<br/>sliced into 16 px screen columns,<br/>each bucketed by its footprint"] --> K
  A["Actors<br/>bucket = ⌊x⌋+⌊y⌋"] --> K
  K["Draw diagonals back → front<br/>tiles, then props & actors sorted by depth"] --> L
  L["Liquids · emitters (smoke, embers, petals) ·<br/>particles · weather"] --> N
  N["Lighting: night tint + glow sprites<br/>for lanterns, braziers, shrines, the heroine"] --> O2["Emotes · quest markers"]
```

### One battle round

`resolveTurn` is a pure function: it takes the game state, the battle state and an action, and returns the new states plus a list of events. The RNG seed lives in the battle state, so a round always replays the same way. `BattleScene` turns those events into a timeline of dashes, projectiles, lightning and pop-ups on an isometric arena themed after the current region.

```mermaid
sequenceDiagram
  participant P as Player (UI)
  participant G as Game runtime
  participant E as Engine.resolveTurn
  participant B as BattleScene timeline
  P->>G: battleAction({skill: "thunder"})
  G->>E: (state, battle, action)
  E-->>G: {game', battle', events[]}
  G->>B: playEvents(events)
  B->>B: heroine "cast" pose
  loop 2 bolts
    B->>B: lightning strike → hit flash, damage pop-up, shake
  end
  B->>B: enemy dashes in / fires its special → heroine "hurt"
  B-->>G: busy = false (or victory → story script)
  G-->>P: UiSnapshot (HP/QI bars, log)
```

## Testing & CI

```mermaid
flowchart LR
  PR["push / pull_request"] --> Q["quality job<br/>npm ci → lint → typecheck →<br/>vitest → art export smoke test"]
  PR --> E2["e2e job<br/>npm ci → next build →<br/>playwright install → playwright test"]
  E2 -- on failure --> R["upload playwright-report"]
```

- **Unit tests (Vitest):** the iso projection and ray caster (shading, depth, decal visibility, convex solids), every character × animation × direction, all portraits and props, terrain and skies. Every area is checked by BFS for reachability of arrival point, NPCs, encounters and interactables. Also covered: world-map connectivity and terrain, a complete story walkthrough from prologue to ascension, realms and battle rules, a headless run of the `Game` runtime (cutscenes, walking and collision, tap-to-walk, the elder's briefing, world-map travel, battles won and lost, boss speeches, the fox quest, meditation and tribulation, pickups, rendering every region), and the API route handlers.
- **E2E (Playwright):** fullscreen title and health check, opening narration and walking, Elder Mo's briefing through to world-map travel, a battle won through the UI, a save/reload/continue round trip with the leaderboard, and the gallery canvases painting.

## Project layout

```
src/
  app/                 Next.js App Router: pages (/, /gallery) + API route handlers
  components/          React UI (GameApp, GameView, SpriteGallery, canvas loop hook)
  game/
    pixel/             PixelBuffer, colour, noise, RNG, 3×5 font, Surface abstraction
    iso/               isometric projection + z-buffered pixel-art ray caster
    art/               palettes, humanoid & beast rigs, character registry & portraits,
                       props, terrain tiles, skies
    world/             tile maps, the six areas, the overworld
    story/             cutscene step types, quests, dialogue, scripted scenes
    engine/            realms, enemies, battle, zod save schema (pure)
    runtime/           Game loop, World (iso area), WorldMap, BattleScene, particles, title
  server/              save store (atomic JSON file / memory)
tests/                 Vitest unit tests
e2e/                   Playwright specs (+ screenshot capture)
scripts/               GIF/PNG art export
docs/                  screenshots & exported art
```
