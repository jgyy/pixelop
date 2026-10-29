import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector2, Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Effect } from "@babylonjs/core/Materials/effect";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Constants } from "@babylonjs/core/Engines/constants";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration";
import "@babylonjs/core/Shaders/ShadersInclude/instancesVertex";
import { parseColor } from "../pixel/color";
import type { PixelBuffer } from "../pixel/PixelBuffer";
import { COS_E, TILE_U } from "../iso/raster";
import { charDef, frameAt, getAnim } from "../art/characters";
import { propDef, type PropId } from "../art/props";
import { LIQUID_TONES, wallSwatch } from "../art/tiles";
import { TILE_KINDS } from "../world/tilemap";
import type { Season } from "../world/calendar";
import type { Game } from "../runtime/Game";
import type { Actor, World } from "../runtime/world";
import { dirInView, type View3D } from "../runtime/view";
import { propModel, sways } from "./propModels";
import { buildChunk, CHUNK, LEVEL, mapWindow, type Chunk, type Mesh as MeshData } from "./terrain";
import * as GL from "./shaders";

/** Tiles per sprite pixel: the art's own scale, so the folk stand true to the halls they walk in. */
const PX = 1 / TILE_U;
/** The camera's turn that looks at the land exactly as the isometric view does. */
export const ISO_ALPHA = -Math.PI / 4;
/** How far chunks are kept loaded about the camera's focus (tiles). */
const LOAD_R = 64;
const DROP_R = 100;
/** Folk and beasts are drawn within this many tiles of the focus. */
const ACTOR_R = 60;
/** Props are set out within this many tiles of the focus (the haze hides the rest). */
const PROP_R = 58;

/** The sun of the iso art (up-left, toward the viewer), in the 3D frame. */
const SUN = new Vector3(-0.0707, 0.75, -0.707).normalize();

export interface CameraState {
  /** Turn about the focus (radians); ISO_ALPHA is the isometric view. */
  alpha: number;
  /** Tilt down from overhead (radians). */
  beta: number;
  radius: number;
}

export const DEFAULT_CAMERA: CameraState = { alpha: ISO_ALPHA, beta: 0.88, radius: 21 };

const rgb = (c: string): [number, number, number] => {
  const [r, g, b] = parseColor(c);
  return [r / 255, g / 255, b / 255];
};

let shadersRegistered = false;
function registerShaders(): void {
  if (shadersRegistered) return;
  shadersRegistered = true;
  const S = Effect.ShadersStore;
  S.jlPropVertexShader = GL.PROP_VERTEX;
  S.jlPropFragmentShader = GL.PROP_FRAGMENT;
  S.jlGroundVertexShader = GL.GROUND_VERTEX;
  S.jlGroundFragmentShader = GL.GROUND_FRAGMENT;
  S.jlWallVertexShader = GL.WALL_VERTEX;
  S.jlWallFragmentShader = GL.WALL_FRAGMENT;
  S.jlLiquidVertexShader = GL.LIQUID_VERTEX;
  S.jlLiquidFragmentShader = GL.LIQUID_FRAGMENT;
  S.jlSpriteVertexShader = GL.SPRITE_VERTEX;
  S.jlSpriteFragmentShader = GL.SPRITE_FRAGMENT;
  S.jlGlowVertexShader = GL.GLOW_VERTEX;
  S.jlGlowFragmentShader = GL.GLOW_FRAGMENT;
}

const LIGHT_UNIFORMS = ["sunDir", "tintA", "tintB", "golden", "fogColor", "fogRange", "eye"];

interface ChunkSlot {
  key: string;
  ci: number;
  cj: number;
  meshes: Mesh[];
  tex: RawTexture | null;
  /** The ground version and season this chunk was painted for. */
  version: string;
  pending: boolean;
}

interface PropSpot {
  id: PropId;
  x: number;
  y: number;
  z: number;
  k: number;
  i: number;
  j: number;
  when?: (f: Record<string, boolean>) => boolean;
}

interface SpriteSlot {
  mesh: Mesh;
  mat: ShaderMaterial;
  frame: PixelBuffer | null;
  size: string;
  seen: boolean;
}

/**
 * The jianghu in three dimensions, in the manner of the old MMOs: the land,
 * its halls, trees and lanterns are real geometry under a camera you can
 * turn and zoom, while Lin Yue, the folk and the beasts stay hand-painted
 * pixel sprites that always face you (each showing the side of themselves
 * the camera sees, out of their 16 painted directions).
 *
 * The game itself is untouched by it: the view reads the World every frame,
 * and gives the Game a {@link View3D} so movement, taps and the pixel
 * overlay (weather, sparks, the marks over people's heads) follow the camera.
 */
export class WorldView3D implements View3D {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  /** Where the camera is heading (it eases there). */
  readonly want: CameraState = { ...DEFAULT_CAMERA };
  private world: World | null = null;
  private chunks = new Map<string, ChunkSlot>();
  private spots = new Map<string, PropSpot[]>();
  private propMeshes = new Map<string, Mesh>();
  private propSig = "";
  private sprites = new Map<string, SpriteSlot>();
  private textures = new WeakMap<PixelBuffer, RawTexture>();
  private materials: ShaderMaterial[] = [];
  private propMat: ShaderMaterial;
  private wallMat: ShaderMaterial;
  private liquidMat: ShaderMaterial;
  private spriteMat: ShaderMaterial;
  private glowMat: ShaderMaterial;
  private shadowMat: ShaderMaterial;
  private glowMesh: Mesh;
  private shadowMesh: Mesh;
  private workers: Worker[] = [];
  private jobs = new Map<number, { slot: ChunkSlot; version: string }>();
  private jobSeq = 0;
  private busy = 0;
  private time = 0;
  private overlayW = 1;
  private overlayH = 1;
  private viewport = new Viewport(0, 0, 1, 1);
  private seasonKey = "";
  /** Set once the ground round the camera has been painted (for screenshots and tests). */
  ready = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly game: Game,
  ) {
    registerShaders();
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: false, antialias: false, alpha: true, premultipliedAlpha: false }, false);
    const scene = (this.scene = new Scene(this.engine));
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    // later groups (liquids and glows, then the x-ray) keep the depth of the land
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    scene.setRenderingAutoClearDepthStencil(2, false, false, false);
    const c = DEFAULT_CAMERA;
    this.camera = new ArcRotateCamera("cam", c.alpha, c.beta, c.radius, Vector3.Zero(), scene);
    this.camera.fov = 0.62;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 400;

    const mk = (name: string, opts: { attributes: string[]; uniforms: string[]; samplers?: string[] }, alpha = false) => {
      const m = new ShaderMaterial(name, scene, { vertex: name, fragment: name }, { ...opts, uniforms: [...opts.uniforms, ...LIGHT_UNIFORMS], needAlphaBlending: alpha });
      m.backFaceCulling = false;
      this.materials.push(m);
      return m;
    };
    this.propMat = mk("jlProp", { attributes: ["position", "normal", "color"], uniforms: ["world", "viewProjection", "time"] });
    this.wallMat = mk("jlWall", { attributes: ["position", "normal", "uv", "cell"], uniforms: ["world", "viewProjection", "cells"], samplers: ["atlas"] });
    this.liquidMat = mk("jlLiquid", { attributes: ["position", "normal", "uv", "cell"], uniforms: ["world", "viewProjection", "time", "tones"] }, true);
    this.spriteMat = mk("jlSprite", { attributes: ["position", "uv"], uniforms: ["world", "viewProjection", "opacity"], samplers: ["sprite"] });
    this.glowMat = mk("jlGlow", { attributes: ["position", "uv", "glowColor"], uniforms: ["world", "viewProjection", "camRight", "camUp", "flatMode"] }, true);
    this.glowMat.alphaMode = Constants.ALPHA_ADD;
    this.glowMat.disableDepthWrite = true;
    this.shadowMat = mk("jlGlow", { attributes: ["position", "uv", "glowColor"], uniforms: ["world", "viewProjection", "camRight", "camUp", "flatMode"] }, true);
    this.shadowMat.alphaMode = Constants.ALPHA_COMBINE;
    this.shadowMat.disableDepthWrite = true;
    this.shadowMat.setFloat("flatMode", 1);
    this.glowMat.setFloat("flatMode", 0);
    this.liquidMat.setArray3("tones", (["water", "deep", "lava", "paddy"] as const).flatMap((k) => LIQUID_TONES[k].flatMap(rgb)));
    this.wallMat.setTexture("atlas", this.wallAtlas());
    this.wallMat.setFloat("cells", TILE_KINDS.length * 2);
    for (const m of this.materials) m.setVector3("sunDir", SUN);

    this.glowMesh = this.quadMesh("glows", this.glowMat, 1, 1, 0.5, 0.5);
    this.shadowMesh = this.quadMesh("shadows", this.shadowMat, 1, 1, 0.5, 0.5);
    for (const m of [this.glowMesh, this.shadowMesh]) {
      m.thinInstanceRegisterAttribute("glowColor", 4);
      m.alwaysSelectAsActiveMesh = true;
    }
    this.glowMesh.renderingGroupId = 1;
    try {
      for (let n = 0; n < 2; n++) {
        const w = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (e: MessageEvent<{ id: number; chunk: Chunk }>) => this.chunkPainted(e.data.id, e.data.chunk);
        this.workers.push(w);
      }
    } catch {
      this.workers = [];
    }
    game.view3d = this;
  }

  dispose(): void {
    if (this.game.view3d === this) this.game.view3d = null;
    for (const w of this.workers) w.terminate();
    this.scene.dispose();
    this.engine.dispose();
  }

  /** Match the overlay canvas (`w` × `h` game pixels) at `q` render pixels per game pixel. */
  resize(w: number, h: number, q: number): void {
    this.overlayW = w;
    this.overlayH = h;
    const cw = Math.max(1, Math.round(w * q));
    const ch = Math.max(1, Math.round(h * q));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.engine.resize(true);
    }
  }

  // ------------------------------------------------------------------ View3D
  project(x: number, y: number, z: number): [number, number] | null {
    const p = Vector3.Project(new Vector3(x, z * LEVEL, -y), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.viewport);
    if (p.z < 0 || p.z > 1) return null;
    return [p.x * this.overlayW, p.y * this.overlayH];
  }

  tileScale(): number {
    const t = this.camera.target;
    const a = this.project(t.x, -t.z, t.y / LEVEL);
    const r = this.ground().right;
    const b = this.project(t.x + r[0], -t.z + r[1], t.y / LEVEL);
    return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 22;
  }

  ground(): { toward: [number, number]; right: [number, number] } {
    const a = this.camera.alpha;
    // the camera sits at (cos α, sin α) about its target in X/Z; the map's y runs along −Z
    const toward: [number, number] = [Math.cos(a), -Math.sin(a)];
    return { toward, right: [toward[1], -toward[0]] };
  }

  pick(sx: number, sy: number): [number, number] | null {
    const m = this.world?.def.map;
    if (!m) return null;
    const vp = this.scene.getTransformMatrix();
    const near = Vector3.Unproject(new Vector3(sx / this.overlayW, sy / this.overlayH, 0), 1, 1, Matrix.IdentityReadOnly, Matrix.IdentityReadOnly, vp);
    const far = Vector3.Unproject(new Vector3(sx / this.overlayW, sy / this.overlayH, 1), 1, 1, Matrix.IdentityReadOnly, Matrix.IdentityReadOnly, vp);
    const dir = far.subtract(near);
    const len = dir.length();
    dir.scaleInPlace(1 / len);
    // march down the ray until it passes beneath the land
    for (let d = 0; d < Math.min(len, 300); d += 0.1) {
      const x = near.x + dir.x * d;
      const y = -(near.z + dir.z * d);
      const i = Math.floor(x);
      const j = Math.floor(y);
      if (!m.inside(i, j) || m.kind(i, j) === "void") continue;
      if (near.y + dir.y * d <= m.surface(i, j) * LEVEL) return [x, y];
    }
    return null;
  }

  // ------------------------------------------------------------------ frame
  render(dt: number): void {
    const game = this.game;
    const w = game.world;
    if (w !== this.world) this.useWorld(w);
    this.time += dt;
    this.viewport = new Viewport(0, 0, 1, 1);
    this.steerCamera(dt);
    this.updateLight();
    this.streamChunks();
    this.updateProps();
    this.updateActors();
    this.engine.beginFrame();
    this.scene.render();
    this.engine.endFrame();
  }

  private steerCamera(dt: number): void {
    const cam = this.camera;
    const [fx, fy, fz] = this.game.cameraTarget();
    const target = new Vector3(fx, fz * LEVEL + 0.9, -fy);
    const k = Math.min(1, dt * 6);
    const first = cam.target.lengthSquared() === 0;
    cam.target = first ? target : Vector3.Lerp(cam.target, target, k);
    // indoors the camera keeps to the cutaway side, where the walls are open
    const want = this.world?.interior ? { ...this.want, alpha: ISO_ALPHA, beta: Math.min(this.want.beta, 1.0) } : this.want;
    const ease = (a: number, b: number) => (first ? b : a + (b - a) * Math.min(1, dt * 7));
    cam.alpha = ease(cam.alpha, want.alpha);
    cam.beta = ease(cam.beta, want.beta);
    cam.radius = ease(cam.radius, want.radius);
  }

  private updateLight(): void {
    const w = this.world!;
    const env = w.lightAt(this.game.clock);
    const deep = env.dusk * env.dusk * (3 - 2 * env.dusk);
    const night = env.night;
    const dark = night > 0.01 ? Math.min(0.7, night * 0.32 + deep * (w.dayNight && !w.cave ? 0.26 : 0)) : 0;
    const h = env.hour;
    const gold = w.dayNight && !w.cave ? Math.max(0, 1 - Math.abs(h - 6) / 1.6, 1 - Math.abs(h - 18.2) / 1.8) * 0.22 * (w.interior ? 0.5 : 1) : 0;
    const eye = this.camera.position;
    const r = this.camera.radius;
    const fog = w.interior || w.cave ? rgb("#0a0612") : env.sky === "blood" ? rgb("#5a1a2a") : env.sky === "storm" ? rgb("#4a4a6a") : env.sky === "night" ? rgb("#1a1a3a") : rgb(env.sky === "dusk" ? "#e8a888" : env.sky === "forest" ? "#9ac0a0" : "#bcdcf0");
    const fogDark = fog.map((c) => c * (1 - dark)) as [number, number, number];
    const [tr, tg, tb] = rgb(env.tint);
    const [gr, gg, gb] = rgb(h < 12 ? "#ffb890" : "#ff9040");
    const tintA = new Vector4(tr, tg, tb, night * 0.35);
    const tintB = new Vector4(0.04, 0.024, 0.094, dark);
    const golden = new Vector4(gr, gg, gb, gold);
    const fogC = new Vector3(...fogDark);
    const fogR = new Vector2(r * 1.4, Math.min(PROP_R - 4, r * 3));
    for (const m of this.materials) {
      m.setVector4("tintA", tintA);
      m.setVector4("tintB", tintB);
      m.setVector4("golden", golden);
      m.setVector3("fogColor", fogC);
      m.setVector2("fogRange", fogR);
      m.setVector3("eye", eye);
    }
    this.propMat.setFloat("time", this.time);
    this.liquidMat.setFloat("time", this.time);
    this.nightGlow = night > 0.01 ? Math.min(1, 0.5 + night) : 0;
    this.caveLight = w.cave;
  }
  private nightGlow = 0;
  private caveLight = false;

  // ------------------------------------------------------------------ world
  private useWorld(w: World): void {
    for (const c of this.chunks.values()) this.dropChunk(c);
    this.chunks.clear();
    for (const m of this.propMeshes.values()) m.dispose();
    this.propMeshes.clear();
    for (const s of this.sprites.values()) s.mesh.dispose();
    this.sprites.clear();
    this.propSig = "";
    this.ready = false;
    this.world = w;
    this.camera.target = Vector3.Zero();
    // bucket the props by chunk, once
    this.spots.clear();
    const m = w.def.map;
    for (const p of w.def.props) {
      const [x, y] = p.at ?? [p.i + 0.5, p.j + 0.5];
      const z = p.z ?? m.height(Math.floor(x), Math.floor(y));
      const key = `${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)}`;
      let arr = this.spots.get(key);
      if (!arr) this.spots.set(key, (arr = []));
      arr.push({ id: p.id, x, y, z, k: p.k ?? 1, i: p.i, j: p.j, when: p.when });
    }
  }

  private groundVersion(): string {
    const w = this.world!;
    const season = w.yearSeason();
    return `${w.terrainVersion}/${season ?? ""}`;
  }

  private streamChunks(): void {
    const w = this.world!;
    const m = w.def.map;
    const t = this.camera.target;
    const [fx, fy] = [t.x, -t.z];
    const version = this.groundVersion();
    const cmax = Math.ceil(m.w / CHUNK);
    const rmax = Math.ceil(m.h / CHUNK);
    const wanted: ChunkSlot[] = [];
    for (let cj = Math.max(0, Math.floor((fy - LOAD_R) / CHUNK)); cj <= Math.min(rmax - 1, Math.floor((fy + LOAD_R) / CHUNK)); cj++)
      for (let ci = Math.max(0, Math.floor((fx - LOAD_R) / CHUNK)); ci <= Math.min(cmax - 1, Math.floor((fx + LOAD_R) / CHUNK)); ci++) {
        const key = `${ci},${cj}`;
        let slot = this.chunks.get(key);
        if (!slot) this.chunks.set(key, (slot = { key, ci, cj, meshes: [], tex: null, version: "", pending: false }));
        if (slot.version !== version && !slot.pending) wanted.push(slot);
      }
    // nearest first
    const d = (s: ChunkSlot) => Math.hypot((s.ci + 0.5) * CHUNK - fx, (s.cj + 0.5) * CHUNK - fy);
    wanted.sort((a, b) => d(a) - d(b));
    for (const slot of wanted) {
      if (this.workers.length && this.busy >= this.workers.length * 2) break;
      this.paintChunk(slot, version);
      if (!this.workers.length) break;
    }
    for (const slot of [...this.chunks.values()])
      if (d(slot) > DROP_R) {
        this.dropChunk(slot);
        this.chunks.delete(slot.key);
      }
    if (!this.ready) this.ready = [...this.chunks.values()].filter((s) => d(s) < 40).every((s) => s.version === version);
  }

  private paintChunk(slot: ChunkSlot, version: string): void {
    const w = this.world!;
    const def = w.def;
    const season = w.yearSeason();
    const seasonAt = (i: number, j: number): Season | null => w.seasonHere(i, j, season);
    slot.pending = true;
    if (!this.workers.length) {
      this.chunkReady(slot, version, buildChunk(def.map, slot.ci, slot.cj, { base: def.base, floating: def.floating, rocky: w.cave, season: seasonAt }));
      return;
    }
    const id = ++this.jobSeq;
    this.jobs.set(id, { slot, version });
    this.busy++;
    const win = mapWindow(def.map, slot.ci, slot.cj, seasonAt);
    this.workers[id % this.workers.length].postMessage({ id, ci: slot.ci, cj: slot.cj, win, base: def.base, floating: def.floating, rocky: w.cave }, [win.kinds.buffer, win.heights.buffer, win.seasons.buffer]);
  }

  private chunkPainted(id: number, chunk: Chunk): void {
    const job = this.jobs.get(id);
    this.jobs.delete(id);
    this.busy = Math.max(0, this.busy - 1);
    if (!job || this.chunks.get(job.slot.key) !== job.slot) return;
    this.chunkReady(job.slot, job.version, chunk);
  }

  private chunkReady(slot: ChunkSlot, version: string, c: Chunk): void {
    slot.pending = false;
    for (const m of slot.meshes) m.dispose();
    slot.tex?.dispose();
    slot.meshes = [];
    slot.version = version;
    const scene = this.scene;
    if (c.top.indices.length) {
      const tex = RawTexture.CreateRGBATexture(c.tex, c.size, c.size, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      tex.wrapU = tex.wrapV = Texture.CLAMP_ADDRESSMODE;
      slot.tex = tex;
      // a ground material of its own: the same light, its own painted texture
      const ground = new ShaderMaterial(`ground-${slot.key}`, scene, { vertex: "jlGround", fragment: "jlGround" }, { attributes: ["position", "normal", "uv"], uniforms: ["world", "viewProjection", ...LIGHT_UNIFORMS], samplers: ["ground"] });
      ground.setTexture("ground", tex);
      ground.setVector3("sunDir", SUN);
      ground.backFaceCulling = false;
      this.materials.push(ground);
      slot.meshes.push(this.meshFrom(`top-${slot.key}`, c.top, ground));
    }
    if (c.walls.indices.length) slot.meshes.push(this.meshFrom(`walls-${slot.key}`, c.walls, this.wallMat));
    if (c.liquid.indices.length) {
      const lm = this.meshFrom(`liquid-${slot.key}`, c.liquid, this.liquidMat);
      lm.renderingGroupId = 1;
      slot.meshes.push(lm);
    }
    this.propSig = "";
  }

  private dropChunk(slot: ChunkSlot): void {
    for (const m of slot.meshes) {
      const mat = m.material;
      m.dispose();
      if (mat && mat !== this.wallMat && mat !== this.liquidMat) {
        this.materials = this.materials.filter((x) => x !== mat);
        mat.dispose();
      }
    }
    slot.tex?.dispose();
    slot.meshes = [];
    slot.tex = null;
    slot.version = "";
    this.propSig = "";
  }

  private meshFrom(name: string, d: MeshData, mat: ShaderMaterial): Mesh {
    const mesh = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = d.positions;
    vd.normals = d.normals;
    vd.uvs = d.uvs;
    vd.indices = d.indices;
    vd.applyToMesh(mesh, false);
    if (d.cells) mesh.setVerticesData("cell", d.cells, false, 1);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    return mesh;
  }

  private wallAtlas(): RawTexture {
    const n = TILE_KINDS.length;
    const W = n * 2 * 16;
    const data = new Uint8Array(W * 32 * 4);
    for (let r = 0; r < 2; r++)
      TILE_KINDS.forEach((kind, k) => {
        const sw = wallSwatch(kind, r === 1);
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 16; x++) {
            const [cr, cg, cb, ca] = sw.getRGBA(x, y);
            const o = (y * W + (r * n + k) * 16 + x) * 4;
            data.set(ca ? [cr, cg, cb, 255] : [40, 30, 40, 255], o);
          }
      });
    const tex = RawTexture.CreateRGBATexture(data, W, 32, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    return tex;
  }

  // ------------------------------------------------------------------ props
  private updateProps(): void {
    const w = this.world!;
    const flags = w.envFlags;
    const season = w.yearSeason();
    const loaded = [...this.chunks.values()].filter((c) => c.meshes.length || c.version);
    // what is shown changes with the story flags, the season, the taken chests and the animation frame
    const frameClock = Math.floor(this.time * 4);
    const [fx, fy] = [this.camera.target.x, -this.camera.target.z];
    const sig = `${Math.floor(fx / 8)},${Math.floor(fy / 8)}|${loaded.map((c) => c.key).join(";")}|${season}|${w.taken.size}|${Object.keys(flags).filter((k) => flags[k]).length}|${frameClock}`;
    if (sig === this.propSig) return;
    this.propSig = sig;
    const groups = new Map<string, { id: PropId; frame: number; season: Season | null; mats: number[] }>();
    const glows: number[] = [];
    const glowCols: number[] = [];
    for (const c of loaded)
      for (const p of this.spots.get(c.key) ?? []) {
        if (Math.abs(p.x - fx) > PROP_R || Math.abs(p.y - fy) > PROP_R) continue;
        if (p.when && !p.when(flags)) continue;
        const def = propDef(p.id);
        const taken = (p.id === "chest" || p.id === "herb") && w.isTakenAt(p.i, p.j);
        if (taken && p.id === "herb") continue;
        const frame = p.id === "chest" ? (taken ? 1 : 0) : def.frames > 1 && def.fps > 0 && !sways(p.id) ? Math.floor((this.time + (p.i * 7 + p.j * 3) % 5) * def.fps) % def.frames : 0;
        const s = w.seasonHere(p.i, p.j, season);
        const key = `${p.id}/${frame}/${s ?? ""}`;
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { id: p.id, frame, season: s, mats: [] }));
        const m = Matrix.Scaling(p.k, p.k, p.k).multiply(Matrix.Translation(p.x, p.z * LEVEL, -p.y));
        g.mats.push(...m.asArray());
        if (def.light) {
          const L = def.light;
          const size = L.radius * Math.sqrt(p.k) * PX * 2;
          const lift = (L.dy * p.k) / COS_E / TILE_U;
          glows.push(...Matrix.Scaling(size, size, size).multiply(Matrix.Translation(p.x, p.z * LEVEL + lift, -p.y)).asArray());
          glowCols.push(...rgb(L.color), 1);
        }
      }
    for (const [key, mesh] of this.propMeshes)
      if (!groups.has(key)) {
        mesh.thinInstanceCount = 0;
        mesh.setEnabled(false);
      }
    for (const [key, g] of groups) {
      let mesh = this.propMeshes.get(key);
      if (!mesh) {
        const geo = propModel(g.id, g.frame, g.season);
        mesh = new Mesh(`prop-${key}`, this.scene);
        const vd = new VertexData();
        vd.positions = geo.positions;
        vd.normals = geo.normals;
        vd.colors = geo.colors;
        vd.indices = geo.indices;
        vd.applyToMesh(mesh, false);
        mesh.material = this.propMat;
        mesh.isPickable = false;
        mesh.alwaysSelectAsActiveMesh = true;
        this.propMeshes.set(key, mesh);
      }
      mesh.setEnabled(true);
      mesh.thinInstanceSetBuffer("matrix", new Float32Array(g.mats), 16, false);
    }
    this.lampGlows = { mats: glows, cols: glowCols };
  }
  private lampGlows: { mats: number[]; cols: number[] } = { mats: [], cols: [] };

  // ------------------------------------------------------------------ folk
  private updateActors(): void {
    const w = this.world!;
    const t = this.game.clock;
    const g = this.ground();
    const [fx, fy] = [this.camera.target.x, -this.camera.target.z];
    for (const s of this.sprites.values()) s.seen = false;
    const shadows: number[] = [];
    const shadowCols: number[] = [];
    const glows = [...this.lampGlows.mats];
    const glowCols = this.lampGlows.cols.map((c, k) => (k % 4 === 3 ? c * this.nightGlow : c));
    const cam = this.camera;
    const right = Vector3.Cross(cam.upVector, cam.getTarget().subtract(cam.position)).normalize();
    const up = Vector3.Cross(cam.getTarget().subtract(cam.position), right).normalize();
    for (const m of [this.glowMat, this.shadowMat]) {
      m.setVector3("camRight", right);
      m.setVector3("camUp", up);
    }
    for (const a of w.actors) {
      if (a.hidden || Math.abs(a.x - fx) + Math.abs(a.y - fy) > ACTOR_R) continue;
      const slot = this.spriteFor(a);
      slot.seen = true;
      const def = charDef(a.char);
      const fr = frameAt(getAnim(a.char, a.anim, dirInView(a.dir, g), a.outfit), (t - a.animStart) * (a.animRate ?? 1));
      if (slot.frame !== fr) {
        slot.frame = fr;
        slot.mat.setTexture("sprite", this.textureOf(fr));
      }
      const size = `${fr.width}x${fr.height}/${def.ox},${def.oy}`;
      if (slot.size !== size) {
        slot.size = size;
        this.shapeSprite(slot.mesh, fr.width, fr.height, def.ox, def.oy);
      }
      const ground = w.groundZ(a.x, a.y);
      slot.mesh.position.set(a.x, a.z * LEVEL, -a.y);
      const op = (a.opacity ?? 1) * (a.char === "ghost" ? 0.6 + Math.sin(t * 2.3 + a.x) * 0.08 : 1);
      slot.mat.setFloat("opacity", op);
      slot.mesh.setEnabled(op > 0.02);
      const lift = a.z - ground;
      const sw = Math.max(0.15, ((a.char === "crane" || a.char === "bat" ? 5 : def.w > 60 ? 9 : 6) * 2.4 * PX) * (1 - Math.min(0.6, lift * 0.06)));
      shadows.push(...Matrix.Scaling(sw, sw, sw * 0.7).multiply(Matrix.Translation(a.x, ground * LEVEL + 0.02, -a.y)).asArray());
      shadowCols.push(0.08, 0.04, 0.12, 0.42 * op);
      if (a.anim === "lantern" || a.anim === "torch") {
        const s = 40 * PX;
        glows.push(...Matrix.Scaling(s, s, s).multiply(Matrix.Translation(a.x, a.z * LEVEL + 1.1, -a.y)).asArray());
        glowCols.push(...rgb(a.anim === "torch" ? "#ffb060" : "#ff9a50"), Math.min(1, 0.4 + this.nightGlow));
      }
    }
    // the heroine's own light: a torch underground, a faint aura of qi by night
    const h = w.hero;
    const hs = (this.caveLight ? 96 : 52) * PX;
    glows.push(...Matrix.Scaling(hs, hs, hs).multiply(Matrix.Translation(h.x, h.z * LEVEL + 0.9, -h.y)).asArray());
    glowCols.push(...rgb(this.caveLight ? "#ffd8a0" : "#c8fff0"), this.caveLight ? 0.95 : this.nightGlow * 0.45);
    this.xray(w.hero, g, t);
    for (const [key, s] of this.sprites)
      if (!s.seen) {
        s.mesh.dispose();
        s.mat.dispose();
        this.sprites.delete(key);
      }
    this.instances(this.shadowMesh, shadows, shadowCols);
    this.instances(this.glowMesh, glows, glowCols);
  }

  private ghost: SpriteSlot | null = null;
  /** A faint silhouette of the heroine drawn through whatever stands between her and the camera. */
  private xray(h: Actor, g: { toward: [number, number]; right: [number, number] }, t: number): void {
    if (!this.ghost) {
      const mesh = new Mesh("xray", this.scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
      const mat = this.spriteMat.clone("xray") as ShaderMaterial;
      mat.setVector3("sunDir", SUN);
      mat.setFloat("opacity", 0.5);
      mat.depthFunction = Constants.ALWAYS;
      this.materials.push(mat);
      mesh.material = mat;
      this.ghost = { mesh, mat, frame: null, size: "", seen: true };
    }
    const s = this.ghost;
    s.mesh.setEnabled(!h.hidden);
    if (h.hidden) return;
    const def = charDef(h.char);
    const fr = frameAt(getAnim(h.char, h.anim, dirInView(h.dir, g), h.outfit), (t - h.animStart) * (h.animRate ?? 1));
    if (s.frame !== fr) {
      s.frame = fr;
      s.mat.setTexture("sprite", this.textureOf(fr));
    }
    const size = `${fr.width}x${fr.height}/${def.ox},${def.oy}`;
    if (s.size !== size) {
      s.size = size;
      this.shapeSprite(s.mesh, fr.width, fr.height, def.ox, def.oy);
    }
    s.mesh.position.set(h.x, h.z * LEVEL, -h.y);
  }

  private instances(mesh: Mesh, mats: number[], cols: number[]): void {
    mesh.setEnabled(mats.length > 0);
    if (!mats.length) return;
    mesh.thinInstanceSetBuffer("matrix", new Float32Array(mats), 16, false);
    mesh.thinInstanceSetBuffer("glowColor", new Float32Array(cols), 4, false);
  }

  private spriteFor(a: Actor): SpriteSlot {
    let s = this.sprites.get(a.key);
    if (s) return s;
    const mesh = new Mesh(`sprite-${a.key}`, this.scene);
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.isPickable = false;
    const mat = this.spriteMat.clone(`sprite-${a.key}`) as ShaderMaterial;
    mat.setVector3("sunDir", SUN);
    this.materials.push(mat);
    mesh.material = mat;
    s = { mesh, mat, frame: null, size: "", seen: true };
    const dispose = mat.dispose.bind(mat);
    mat.dispose = (...args: Parameters<typeof dispose>) => {
      this.materials = this.materials.filter((x) => x !== mat);
      dispose(...args);
    };
    this.sprites.set(a.key, s);
    return s;
  }

  /** A quad w × h sprite pixels, its foot pixel (ox, oy) at the mesh's origin. */
  private shapeSprite(mesh: Mesh, w: number, h: number, ox: number, oy: number): void {
    const vd = new VertexData();
    const [x0, x1, y0, y1] = [-ox * PX, (w - ox) * PX, (oy - h) * PX, oy * PX];
    vd.positions = [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0];
    vd.uvs = [0, 1, 1, 1, 1, 0, 0, 0];
    vd.indices = [0, 1, 2, 0, 2, 3];
    vd.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
    vd.applyToMesh(mesh, true);
  }

  private quadMesh(name: string, mat: ShaderMaterial, w: number, h: number, ox: number, oy: number): Mesh {
    const mesh = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = [-ox * w, -oy * h, 0, (1 - ox) * w, -oy * h, 0, (1 - ox) * w, (1 - oy) * h, 0, -ox * w, (1 - oy) * h, 0];
    vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    vd.indices = [0, 1, 2, 0, 2, 3];
    vd.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
    vd.applyToMesh(mesh, false);
    mesh.material = mat;
    mesh.isPickable = false;
    return mesh;
  }

  private textureOf(buf: PixelBuffer): RawTexture {
    let t = this.textures.get(buf);
    if (!t) {
      t = RawTexture.CreateRGBATexture(new Uint8Array(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength), buf.width, buf.height, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
      this.textures.set(buf, t);
    }
    return t;
  }
}
