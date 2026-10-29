"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { charDef, getAnim, getPortrait, HUMAN_IDS, PORTRAIT, type CharId, type HumanId } from "@/game/art/characters";
import { SKILLS } from "@/game/engine/battle";
import { ENEMIES, type EnemyId } from "@/game/engine/enemies";
import { SKILL_IDS } from "@/game/engine/state";
import { CanvasSurface } from "@/game/runtime/CanvasSurface";
import type { Game, UiSnapshot } from "@/game/runtime/Game";
import { areaUnlocked, lockReason } from "@/game/story/story";
import { getArea } from "@/game/world/areas";
import { getWorld, regionAt } from "@/game/world/continent";
import { AREA_IDS, type AreaId } from "@/game/world/ids";
import type { Settings } from "@/lib/settings";

const TABS = [
  ["status", "人物", "Status"],
  ["skills", "功法", "Skills"],
  ["bag", "行囊", "Bag"],
  ["bestiary", "妖录", "Bestiary"],
  ["people", "群英", "People"],
  ["places", "地志", "Places"],
  ["settings", "设置", "Settings"],
  ["controls", "操作", "Controls"],
] as const;
export type MenuTab = (typeof TABS)[number][0];

/** Where in the jianghu each beast roams (from the encounters set out on the map). */
let habitats: Map<EnemyId, AreaId[]> | null = null;
function habitatOf(id: EnemyId): AreaId[] {
  if (!habitats) {
    habitats = new Map();
    const w = getWorld();
    for (const e of w.enemies) {
      const r = regionAt(w, e.i + 0.5, e.j + 0.5);
      const arr = habitats.get(e.enemy) ?? [];
      if (!arr.includes(r)) arr.push(r);
      habitats.set(e.enemy, arr);
    }
  }
  return habitats.get(id) ?? [];
}

/** Keepsakes and quest things she carries, read from the tale so far. */
function keepsakes(f: Record<string, boolean>): { hanzi: string; name: string; note: string }[] {
  const out: { hanzi: string; name: string; note: string }[] = [];
  if (f.metElder) out.push({ hanzi: "玉哨", name: "Jade Whistle", note: "Elder Mo's gift. Blow it (R) and Cloudmane comes down out of the clouds." });
  if (f.metElder) out.push({ hanzi: "御剑", name: "Sword-Riding Manual", note: "The sect's first lesson in flight (F). Crosses water the horse cannot." });
  if (f.patriarchDefeated && !f.heartReturned) out.push({ hanzi: "玉莲心", name: "Jade Lotus Heart", note: "Taken back from the Crimson Demon Valley. It hums against her ribs, waiting to go home." });
  if (f.heartReturned) out.push({ hanzi: "玉莲心", name: "Jade Lotus Heart (returned)", note: "It sits again on the sect's altar. She can still feel its warmth when she meditates." });
  if (f.dawnfrost && !f.ouMail) out.push({ hanzi: "破晓", name: "Dawnfrost", note: "Xue Ming's first sword, never drawn in anger. Smith Ou would want it home." });
  if (f.yunTea && !f.wenReply) out.push({ hanzi: "茶砖", name: "Master Yun's Tea Brick", note: "“Not an apology,” he said. For Old Fisher Wen at the Lotus Lake." });
  if (f.wenReply && !f.brothersReconciled) out.push({ hanzi: "月珠", name: "Moon-Pearl", note: "Old Fisher Wen's answer, for Master Yun on the Cloudstep Isles." });
  if (f.haiPeach && !f.haiCoat) out.push({ hanzi: "仙桃", name: "Orchard Peach", note: "From Auntie Rong's trees, for Captain Hai at Wavecrest Harbour." });
  if (f.huliLetter) out.push({ hanzi: "书信", name: "Scholar Pei's Letter", note: "Its last line was read aloud at last. She keeps the empty envelope." });
  return out;
}

const fmtTime = (s: number) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;

/**
 * The game menu (Esc / Tab): Lin Yue's status and skills, what she carries,
 * the beasts and people she has met, the places of the jianghu, and how the
 * world is drawn.
 */
export function GameMenu({ ui, game, settings, onSettings, onSave, onQuit }: { ui: UiSnapshot; game: Game; settings: Settings; onSettings: (s: Settings) => void; onSave: () => void; onQuit: () => void }) {
  const [tab, setTab] = useState<MenuTab>("status");
  useEffect(() => {
    // ← → (or Q / E) page through the tabs while the menu is up
    const key = (e: KeyboardEvent) => {
      const k = TABS.findIndex((t) => t[0] === tab);
      if (e.code === "ArrowRight" || e.code === "BracketRight") setTab(TABS[(k + 1) % TABS.length][0]);
      if (e.code === "ArrowLeft" || e.code === "BracketLeft") setTab(TABS[(k + TABS.length - 1) % TABS.length][0]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tab]);
  return (
    <div className="game-menu panel" data-testid="game-menu" role="dialog" aria-label="Game menu">
      <nav>
        {TABS.map(([id, hanzi, name]) => (
          <button key={id} className={`btn${tab === id ? " primary" : ""}`} onClick={() => setTab(id)} data-testid={`menu-tab-${id}`}>
            <span className="cn">{hanzi}</span> {name}
          </button>
        ))}
      </nav>
      <section className="menu-body" data-testid={`menu-${tab}`}>
        {tab === "status" && <StatusTab ui={ui} />}
        {tab === "skills" && <SkillsTab ui={ui} />}
        {tab === "bag" && <BagTab ui={ui} game={game} />}
        {tab === "bestiary" && <BestiaryTab ui={ui} />}
        {tab === "people" && <PeopleTab ui={ui} />}
        {tab === "places" && <PlacesTab ui={ui} />}
        {tab === "settings" && <SettingsTab settings={settings} onSettings={onSettings} />}
        {tab === "controls" && <ControlsTab />}
      </section>
      <footer>
        <span className="hint">
          <span className="kbd">←</span>
          <span className="kbd">→</span> tabs · <span className="kbd">Esc</span> close
        </span>
        <button className="btn" onClick={onSave} data-testid="menu-save">
          Save
        </button>
        <button className="btn" onClick={onQuit}>
          Title
        </button>
        <button className="btn primary" onClick={() => game.toggleMenu()} data-testid="menu-close">
          Resume
        </button>
      </footer>
    </div>
  );
}

function StatusTab({ ui }: { ui: UiSnapshot }) {
  const s = ui.state;
  const rows: [string, string | number][] = [
    ["Realm", ui.realm],
    ["Cultivation", ui.bottleneck ? "At the bottleneck" : `${s.cultivation} / ${ui.cultivationNeeded}`],
    ["Vitality", `${s.hp} / ${ui.stats.maxHp}`],
    ["Qi", `${s.qi} / ${ui.stats.maxQi}`],
    ["Attack", ui.stats.atk],
    ["Defence", ui.stats.def],
    ["Speed", ui.stats.spd],
    ["Dao Heart", ui.dao.label ?? "—"],
    ["Great Daos", ui.wu.label ? `${ui.wu.label} · ${ui.wu.total} stages` : "—"],
    ["Attire", ui.attire.name],
    ["Beasts bested", s.kills],
    ["Spirit stones", s.stones],
    ["Notices fulfilled", `${ui.noticesDone} / ${ui.noticeCount}`],
    ["Time in the jianghu", fmtTime(s.playTime)],
  ];
  return (
    <div className="status-tab">
      <div className="status-portrait">
        <Portrait id="heroine" outfit={ui.attire.id} />
        <strong>{s.name}</strong>
        <small style={{ color: ui.realmColour }}>{ui.realm}</small>
        {ui.condition.label && <small className="warn">⚠ {ui.condition.label}</small>}
      </div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SkillsTab({ ui }: { ui: UiSnapshot }) {
  const learned = new Set(ui.state.skills);
  return (
    <ul className="menu-list">
      {SKILL_IDS.map((id) => {
        const sk = SKILLS[id];
        const has = learned.has(id);
        return (
          <li key={id} className={has ? "" : "locked"} data-testid={`menu-skill-${id}`}>
            <span className="cn">{has ? sk.hanzi : "？"}</span>
            <div>
              <strong>{has ? sk.name : "Unlearned technique"}</strong>
              <p>{has ? sk.description : "Grow in cultivation: the sect teaches what a realm can bear."}</p>
            </div>
            <b>{has ? (sk.qi ? `${sk.qi} qi` : "free") : ""}</b>
            {has && <span className="kbd">{sk.key}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function BagTab({ ui, game }: { ui: UiSnapshot; game: Game }) {
  const s = ui.state;
  const items = keepsakes(s.flags);
  return (
    <div>
      <ul className="menu-list">
        <li>
          <span className="cn">💊</span>
          <div>
            <strong>Healing Pill × {s.pills.heal}</strong>
            <p>Restores vitality. Every pill leaves a little poison behind.</p>
          </div>
          <button className="btn small" disabled={s.pills.heal <= 0} onClick={() => game.takePill("heal")} data-testid="menu-use-heal">
            Use <span className="kbd">H</span>
          </button>
        </li>
        <li>
          <span className="cn">🔷</span>
          <div>
            <strong>Qi Gathering Pill × {s.pills.qi}</strong>
            <p>Refills her qi for the techniques.</p>
          </div>
          <button className="btn small" disabled={s.pills.qi <= 0} onClick={() => game.takePill("qi")} data-testid="menu-use-qi">
            Use <span className="kbd">Q</span>
          </button>
        </li>
        <li>
          <span className="cn">◆</span>
          <div>
            <strong>Spirit Stones × {s.stones}</strong>
            <p>The coin of cultivators. Alchemists and teahouses take them.</p>
          </div>
        </li>
      </ul>
      <h4>Keepsakes</h4>
      {items.length === 0 && <p className="muted">Nothing yet but the robes on her back.</p>}
      <ul className="menu-list">
        {items.map((it) => (
          <li key={it.name}>
            <span className="cn">{it.hanzi}</span>
            <div>
              <strong>{it.name}</strong>
              <p>{it.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BestiaryTab({ ui }: { ui: UiSnapshot }) {
  const c = ui.state.counters;
  const all = useMemo(() => (Object.keys(ENEMIES) as EnemyId[]).filter((id) => !ENEMIES[id].friendly), []);
  const seen = all.filter((id) => c[`seen:${id}`] || c[`slain:${id}`]);
  return (
    <div>
      <p className="muted">
        Beasts and foes met: {seen.length} / {all.length}. Fight one to learn its ways.
      </p>
      <ul className="bestiary">
        {seen.map((id) => {
          const e = ENEMIES[id];
          const where = habitatOf(id).map((r) => getArea(r).name);
          return (
            <li key={id} className={e.boss ? "boss" : ""} data-testid={`beast-${id}`}>
              <SpriteThumb char={e.sprite} />
              <div>
                <strong>
                  {e.boss ? "☠ " : ""}
                  {e.name}
                </strong>
                <small>
                  Lv {e.level} · HP {e.hp} · ATK {e.atk} · DEF {e.def}
                </small>
                <small>Signature: {e.special.name}</small>
                <small>{where.length ? `Roams: ${where.join(", ")}` : "Met once, where the tale led"}</small>
                <small>Bested × {c[`slain:${id}`] ?? 0}</small>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PeopleTab({ ui }: { ui: UiSnapshot }) {
  const c = ui.state.counters;
  const all = useMemo(() => HUMAN_IDS.filter((id) => id !== "heroine" && charDef(id).portrait), []);
  const met = all.filter((id) => c[`met:${id}`]);
  return (
    <div>
      <p className="muted">
        Folk of the jianghu she has spoken with: {met.length} / {all.length}.
      </p>
      <ul className="people">
        {met.map((id) => {
          const d = charDef(id);
          return (
            <li key={id} data-testid={`person-${id}`}>
              <Portrait id={id} />
              <strong>{d.name}</strong>
              <small>{d.title}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlacesTab({ ui }: { ui: UiSnapshot }) {
  const s = ui.state;
  return (
    <ul className="menu-list">
      {AREA_IDS.map((id) => {
        const a = getArea(id);
        const open = areaUnlocked(id, s);
        const here = ui.area.id === id;
        return (
          <li key={id} className={open ? (here ? "here" : "") : "locked"} data-testid={`place-${id}`}>
            <span className="cn">{a.hanzi}</span>
            <div>
              <strong>
                {a.name}
                {here ? " · you are here" : ""}
              </strong>
              <p>{open ? a.subtitle : (lockReason(id, s) ?? "")}</p>
            </div>
            <b>{open ? "Open" : "Sealed"}</b>
          </li>
        );
      })}
    </ul>
  );
}

function SettingsTab({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const set = (p: Partial<Settings>) => onSettings({ ...settings, ...p });
  return (
    <div className="settings">
      <label>
        <span>World view</span>
        <span className="seg">
          <button className={`btn small${settings.view === "3d" ? " primary" : ""}`} onClick={() => set({ view: "3d" })} data-testid="set-view-3d">
            3D (Babylon.js)
          </button>
          <button className={`btn small${settings.view === "2d" ? " primary" : ""}`} onClick={() => set({ view: "2d" })} data-testid="set-view-2d">
            Isometric pixels
          </button>
        </span>
      </label>
      <label>
        <span>3D detail</span>
        <span className="seg">
          {(
            [
              [1, "Chunky"],
              [2, "Crisp"],
              [3, "Smooth"],
            ] as const
          ).map(([q, name]) => (
            <button key={q} className={`btn small${settings.quality === q ? " primary" : ""}`} onClick={() => set({ quality: q })} disabled={settings.view !== "3d"} data-testid={`set-quality-${q}`}>
              {name}
            </button>
          ))}
        </span>
      </label>
      <label>
        <span>Compass</span>
        <input type="checkbox" checked={settings.compass} onChange={(e) => set({ compass: e.target.checked })} data-testid="set-compass" />
      </label>
      <label>
        <span>Invert camera drag</span>
        <input type="checkbox" checked={settings.invertDrag} onChange={(e) => set({ invertDrag: e.target.checked })} />
      </label>
      <p className="muted">The game saves itself to the server every minute while you explore. Settings are kept in this browser.</p>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ["W A S D / ←↑→↓", "Walk (hold Shift to run, or gallop on Cloudmane)"],
  ["Click / tap", "Walk to that spot"],
  ["E / Space / Enter", "Talk, read, gather, open, step through doors"],
  ["F", "Ride the flying sword (crosses water)"],
  ["R", "Whistle for Cloudmane"],
  ["M", "World map"],
  ["J", "Journal"],
  ["V / C", "Wardrobe / next outfit"],
  ["H / Q", "Healing pill / qi pill"],
  ["B", "Face the heavenly tribulation (at the bottleneck)"],
  ["Esc / Tab", "This menu"],
  ["Z / X", "Turn the 3D camera (or drag with the right mouse button)"],
  ["+ / − / wheel", "Zoom the 3D camera"],
  ["Home", "Set the camera back to the isometric angle"],
  ["1 – 7, 0", "Battle: techniques, pills, flee"],
];

function ControlsTab() {
  return (
    <dl className="controls">
      {CONTROLS.map(([k, v]) => (
        <div key={k}>
          <dt>
            <span className="kbd">{k}</span>
          </dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Portrait({ id, outfit }: { id: HumanId; outfit?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PORTRAIT, PORTRAIT);
    new CanvasSurface(ctx).sprite(getPortrait(id, outfit)[0], 0, 0);
  }, [id, outfit]);
  return <canvas ref={ref} className="portrait small" width={PORTRAIT} height={PORTRAIT} />;
}

function SpriteThumb({ char }: { char: CharId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const def = charDef(char);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, def.w, def.h);
    new CanvasSurface(ctx).sprite(getAnim(char, "idle", 2).frames[0], 0, 0);
  }, [char, def]);
  // cropped to the figure, shown at twice its size
  return <canvas ref={ref} className="thumb" width={def.w} height={def.h} style={{ width: Math.min(120, def.w * 1.6), height: Math.min(120, def.w * 1.6) * (def.h / def.w) }} />;
}
