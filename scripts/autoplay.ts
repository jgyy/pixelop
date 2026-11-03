/**
 * Headless autoplay: run the game with the autoplay bot at the keys, with no
 * browser, and write a report of how far it got and what went wrong.
 *
 *   npm run autoplay -- --minutes 20 --seed 3 --choose random --travel teleport --assist --out report.json
 *
 * --minutes   game time to play (default 10)
 * --seed      the bot's own seed (which answer, which beast) and the game's (default 1)
 * --choose    first | cycle | random: how it answers questions (default cycle)
 * --travel    walk | teleport: how it gets about (default teleport, for speed)
 * --origin    disciple | foundling | defector: which beginning (default disciple)
 * --assist    lift her a stage whenever the tale stalls on her realm
 * --read      read every line instead of skipping through talk
 * --quiet     do not print the log as it goes
 * --out       where to write the JSON report (default: print only)
 *
 * Exit code 1 if the game threw, so it can run in CI as a smoke test.
 */
import { writeFileSync } from "node:fs";
import { AutoPlayer, type ChoicePolicy } from "../src/game/bot/autoplay";
import { newGameAs, type OriginId } from "../src/game/story/origins";
import { Game } from "../src/game/runtime/Game";

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const k = args.indexOf(`--${name}`);
  return k >= 0 && args[k + 1] && !args[k + 1].startsWith("--") ? args[k + 1] : def;
};
const has = (name: string) => args.includes(`--${name}`);

const minutes = Number(opt("minutes", "10"));
const seed = Number(opt("seed", "1"));
const t0 = Date.now();
const game = new Game(newGameAs(opt("origin", "disciple") as OriginId), { intro: true, seed });
console.log(`world built in ${((Date.now() - t0) / 1000).toFixed(1)} s; playing ${minutes} min of game time`);
const bot = new AutoPlayer(game, {
  seed,
  choose: opt("choose", "cycle") as ChoicePolicy,
  travel: opt("travel", "teleport") as "walk" | "teleport",
  assist: has("assist"),
  read: has("read"),
  stallAfter: Number(opt("stall", "300")),
  onEvent: has("quiet") ? undefined : (e) => console.log(`[${String(e.t).padStart(7)}s] ${e.kind.padEnd(11)} ${e.text}`),
});
const t1 = Date.now();
const report = bot.run(minutes * 60);
console.log(`\nplayed ${report.seconds} s of game time in ${((Date.now() - t1) / 1000).toFixed(1)} s`);
console.log(`realm ${report.realm} · flags ${report.flags} · talks ${report.talks} · battles ${report.battles.won} won / ${report.battles.lost} lost · choices ${report.choices} · jumps ${report.teleports}`);
console.log(`threads: ${Object.entries(report.threads).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`regions seen: ${report.regions.join(", ")}`);
if (report.stalls.length) console.log(`stalls (${report.stalls.length}):\n${report.stalls.map((s) => `  at ${s.t}s: ${s.objectives[0] ?? "?"}`).join("\n")}`);
if (report.errors.length) console.log(`ERRORS (${report.errors.length}):\n${report.errors.map((e) => `  at ${e.t}s: ${e.message}`).join("\n")}`);
const out = opt("out", "");
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
process.exit(report.errors.length ? 1 : 0);
