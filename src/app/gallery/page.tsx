import type { Metadata } from "next";
import Link from "next/link";
import { SpriteGallery } from "@/components/SpriteGallery";

export const metadata: Metadata = {
  title: "Pixel Art Gallery — Jade Lotus Ascension",
  description: "Every character, prop and region in the game, animated live from procedural pixel art.",
};

export default function GalleryPage() {
  return (
    <main className="shell gallery">
      <nav className="topnav">
        <Link href="/" className="btn">
          ◀ Back to the game
        </Link>
      </nav>
      <h1>Pixel Art Gallery</h1>
      <p className="lead">Every character, prop and region below is ray cast procedurally in TypeScript at load time (no image files), animated live, in up to 16 facing directions.</p>
      <SpriteGallery />
    </main>
  );
}
