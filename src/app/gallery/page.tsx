import type { Metadata } from "next";
import Link from "next/link";
import { SpriteGallery } from "@/components/SpriteGallery";

export const metadata: Metadata = {
  title: "Pixel Art Gallery — Jade Lotus Ascension",
  description: "Every character, beast and background in the game, animated live from procedural pixel art.",
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
      <p className="lead">Every sprite and backdrop below is painted procedurally in TypeScript at load time — no image files — and animated live.</p>
      <SpriteGallery />
    </main>
  );
}
