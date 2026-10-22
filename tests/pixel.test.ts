import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { alpha, mix, parseColor, shade, toHex } from "@/game/pixel/color";
import { drawText, textWidth } from "@/game/pixel/font";
import { createRng, hashString } from "@/game/pixel/rng";
import { BufferSurface } from "@/game/pixel/surface";

describe("colour helpers", () => {
  it("parses short, long and alpha hex", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255, 255]);
    expect(parseColor("#3fb59a")).toEqual([63, 181, 154, 255]);
    expect(parseColor("#00000080")).toEqual([0, 0, 0, 128]);
    expect(() => parseColor("#zzzzzz")).toThrow();
  });
  it("mixes, fades and shades", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(alpha("#ff0000", 0.5)).toBe("#ff000080");
    expect(shade("#808080", 0.5)).toBe("#404040");
    expect(toHex([1, 2, 3, 255])).toBe("#010203");
  });
});

describe("PixelBuffer", () => {
  it("plots, clips and blends", () => {
    const b = new PixelBuffer(4, 4);
    b.px(1, 1, "#ff0000");
    b.px(-1, 9, "#ff0000"); // out of bounds: ignored
    expect(b.getRGBA(1, 1)).toEqual([255, 0, 0, 255]);
    b.px(1, 1, "#0000ff80");
    const [r, , bl, a] = b.getRGBA(1, 1);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(100);
    expect(bl).toBeGreaterThan(100);
    expect(b.opaqueCount()).toBe(1);
  });

  it("fills rects, ellipses and polygons", () => {
    const b = new PixelBuffer(20, 20);
    b.rect(0, 0, 5, 5, "#fff");
    expect(b.opaqueCount()).toBe(25);
    const e = new PixelBuffer(20, 20);
    e.ellipse(10, 10, 4, 4, "#fff");
    expect(e.alphaAt(10, 10)).toBe(255);
    expect(e.alphaAt(0, 0)).toBe(0);
    const p = new PixelBuffer(20, 20);
    p.polygon([[0, 0], [10, 0], [0, 10]], "#fff");
    expect(p.alphaAt(1, 1)).toBe(255);
    expect(p.alphaAt(9, 9)).toBe(0);
  });

  it("blits with mirroring and builds outlines", () => {
    const src = new PixelBuffer(3, 1);
    src.px(0, 0, "#ff0000");
    const dst = new PixelBuffer(3, 1);
    dst.blit(src, 0, 0, true);
    expect(dst.getRGBA(2, 0)[0]).toBe(255);
    expect(dst.alphaAt(0, 0)).toBe(0);

    const dot = new PixelBuffer(5, 5);
    dot.px(2, 2, "#ffffff");
    const o = dot.outlined("#000000");
    expect(o.opaqueCount()).toBe(5);
    expect(o.getRGBA(2, 1)).toEqual([0, 0, 0, 255]);
  });

  it("tints and scales", () => {
    const b = new PixelBuffer(2, 2);
    b.px(0, 0, "#000000");
    expect(b.tinted("#ffffff").getRGBA(0, 0)).toEqual([255, 255, 255, 255]);
    const s = b.scaled(3);
    expect(s.width).toBe(6);
    expect(s.opaqueCount()).toBe(9);
  });
});

describe("rng and font", () => {
  it("is deterministic per seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashString("sect")).toBe(hashString("sect"));
    expect(hashString("sect")).not.toBe(hashString("lake"));
  });
  it("renders 3x5 glyphs", () => {
    expect(textWidth("12")).toBe(7);
    const buf = new PixelBuffer(20, 8);
    drawText(new BufferSurface(buf), "1", 0, 0, "#ffffff");
    expect(buf.opaqueCount()).toBe(8);
  });
});
