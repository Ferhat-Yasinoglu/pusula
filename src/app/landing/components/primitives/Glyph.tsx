import type { CSSProperties, ReactNode } from "react";
import { cx } from "./primitiveKit";
import "./primitives.css";

/**
 * The landing page's only icon source: hand-drawn 24-unit inline SVGs with a
 * 1.5px stroke (`vector-effect: non-scaling-stroke`, so the line stays 1.5px
 * at 16, 20 or 24px). Material Symbols is not used anywhere under `/landing`.
 *
 * Glyphs are decoration (`aria-hidden`); the control around a glyph carries
 * the accessible name. `arrow` and `chevron` point towards the inline end and
 * mirror under RTL (`.glyph-dir`); every other glyph is direction-neutral.
 *
 * No hooks and no `"use client"`: server components (the hero and map
 * posters) can render glyphs as well.
 */

export type GlyphName =
  | "copy"
  | "check"
  | "menu"
  | "close"
  | "arrow"
  | "external"
  | "search"
  | "pause"
  | "play"
  | "globe"
  | "chevron"
  | "bolt"
  | "lock"
  | "star4"
  | "star8"
  | "compass"
  | "github"
  | "docs"
  | "scales";

export type GlyphSize = 16 | 20 | 24;

export type GlyphProps = {
  name: GlyphName;
  size?: GlyphSize;
  /** "gold" (default) paints the brand gold; "current" inherits `color` (e.g. dark text on a gold button). */
  tone?: "gold" | "current";
  className?: string;
  style?: CSSProperties;
};

export const GLYPH_NAMES: readonly GlyphName[] = [
  "copy",
  "check",
  "menu",
  "close",
  "arrow",
  "external",
  "search",
  "pause",
  "play",
  "globe",
  "chevron",
  "bolt",
  "lock",
  "star4",
  "star8",
  "compass",
  "github",
  "docs",
  "scales",
];

/** Glyphs that point along the reading direction and therefore mirror in RTL. */
export const DIRECTIONAL_GLYPHS: ReadonlySet<GlyphName> = new Set<GlyphName>(["arrow", "chevron"]);

const PATHS: Record<GlyphName, ReactNode> = {
  copy: (
    <>
      <rect x="4" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M8.5 8.5V6a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-2.5" />
    </>
  ),
  check: <path d="M4.5 12.5l4.75 4.75L19.5 7" />,
  menu: <path d="M4 7.5h16M4 12h16M4 16.5h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  arrow: <path d="M4 12h15.5M13.5 6l6 6-6 6" />,
  external: (
    <path d="M13.5 4H20v6.5M20 4l-9 9M17.5 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h4" />
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="M15.25 15.25L20 20" />
    </>
  ),
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  play: <path d="M8 5.6v12.8a.6.6 0 0 0 .92.5l9.7-6.4a.6.6 0 0 0 0-1l-9.7-6.4A.6.6 0 0 0 8 5.6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5s-1.2 6-3.6 8.5M12 3.5C9.6 6 8.4 8.8 8.4 12s1.2 6 3.6 8.5" />
    </>
  ),
  chevron: <path d="M9.5 6l6 6-6 6" />,
  bolt: <path d="M13.5 3L5.5 13.25h6L10.5 21l8-10.25h-6L13.5 3z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V7.75a3.5 3.5 0 0 1 7 0v2.75M12 14.25v2" />
    </>
  ),
  star4: (
    <path d="M12 2.75c.55 4.85 3.4 7.7 9.25 9.25-5.85 1.55-8.7 4.4-9.25 9.25-.55-4.85-3.4-7.7-9.25-9.25C8.6 10.45 11.45 7.6 12 2.75z" />
  ),
  star8: (
    <>
      <path d="M12 2L12.92 9.78L15.96 8.04L14.22 11.08L22 12L14.22 12.92L15.96 15.96L12.92 14.22L12 22L11.08 14.22L8.04 15.96L9.78 12.92L2 12L9.78 11.08L8.04 8.04L11.08 9.78Z" />
      <circle cx="12" cy="12" r="1.1" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 5.75l2.1 6.25L12 18.25 9.9 12 12 5.75zM9.9 12h4.2" />
    </>
  ),
  github: (
    <>
      <path d="M15 21v-3.25c0-.95-.3-1.65-.85-2.15 2.75-.3 5.35-1.35 5.35-5.75 0-1.25-.45-2.3-1.2-3.1.1-.4.5-1.6-.1-3.15 0 0-1-.3-3.25 1.2a11.2 11.2 0 0 0-5.9 0C5.8 3.3 4.8 3.6 4.8 3.6c-.6 1.55-.2 2.75-.1 3.15-.75.8-1.2 1.85-1.2 3.1 0 4.4 2.6 5.45 5.35 5.75-.4.35-.7.9-.8 1.65V21" />
      <path d="M8.95 18.6c-3.45 1.05-3.45-1.6-4.95-2" />
    </>
  ),
  /* An open book: two pages on a spine (documentation). */
  docs: (
    <path d="M12 6.75C10.1 5.2 7.5 4.6 3.75 4.75v13.5c3.75-.15 6.35.45 8.25 2 1.9-1.55 4.5-2.15 8.25-2V4.75c-3.75-.15-6.35.45-8.25 2zM12 6.75v13.5" />
  ),
  /* A balance: post, foot, beam and two hanging pans (a judge weighing replies). */
  scales: (
    <>
      <path d="M12 4.5v15M8.5 19.5h7M4.75 7.5h14.5" />
      <path d="M4.75 7.5L2.5 13M4.75 7.5L7 13M2.5 13h4.5a2.25 2.25 0 0 1-4.5 0z" />
      <path d="M19.25 7.5L17 13M19.25 7.5L21.5 13M17 13h4.5a2.25 2.25 0 0 1-4.5 0z" />
    </>
  ),
};

export default function Glyph({ name, size = 20, tone = "gold", className, style }: GlyphProps) {
  return (
    <svg
      className={cx(
        "glyph",
        tone === "gold" && "glyph-gold",
        DIRECTIONAL_GLYPHS.has(name) && "glyph-dir",
        className
      )}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-glyph={name}
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}
