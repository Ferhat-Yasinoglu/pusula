"use client";
import {
  useCallback,
  useEffect,
  useRef,
  type FocusEventHandler,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import Link from "next/link";
import { usePrefersReducedMotion } from "../../landingMotion";
import Glyph, { type GlyphName } from "./Glyph";
import { cx, hasFinePointer, magnetPull, type MagnetPull } from "./primitiveKit";
import "./primitives.css";

/**
 * The page's buttons and call-to-action links.
 *
 * - `gold`: gold metal fill, `--void` text, `--glow-cta`, and a halo whose
 *   opacity breathes .35 ↔ .7 over 3s. `ghost`: a 1px `--rule` outline with
 *   foam text.
 * - Magnet, on a fine pointer only and never under reduced motion: within
 *   `radius` px of the button's edge, the plate follows the pointer by
 *   `strength` (clamped to ±8px) and its label by ±3px more, then springs
 *   back over 280ms. The hit area itself never moves; only the inner plate
 *   does, so the click target stays where the visitor aimed.
 * - Press: `scale(.97)` for 120ms. Min height 44px (48px on a phone).
 * - An `arrow` or `chevron` icon mirrors in RTL (through `Glyph`).
 *
 * Renders next/link for internal paths, `<a>` for hashes and external URLs
 * (external ones open in a new tab), and `<button>` without `href`.
 */

export type MagneticButtonProps = {
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  variant: "gold" | "ghost";
  size?: "md" | "lg";
  /** Share of the pointer offset the plate follows (default .25). */
  strength?: number;
  /** Reach of the magnet beyond the button's edges, in px (default 80). */
  radius?: number;
  icon?: GlyphName;
  children: ReactNode;
  /** Force a new tab (otherwise inferred from an absolute http(s) URL). */
  external?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  id?: string;
  title?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-pressed"?: boolean;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  className?: string;
  /** The rendered `<a>`/`<button>` (for measuring, e.g. a needle aiming at it). */
  ref?: Ref<HTMLElement>;
};

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:");
}

/**
 * Wire the magnet to one button. The button's rect is read lazily, at most
 * once per scroll or resize (on the next pointer move), never in a loop; the
 * plate's offset is written as CSS custom properties that a `transform`
 * transition follows.
 */
function attachMagnet(root: HTMLElement, strength: number, radius: number): () => void {
  const pull: MagnetPull = { active: false, x: 0, y: 0, labelX: 0, labelY: 0 };
  let measured = false;
  let cx = 0;
  let cy = 0;
  let hw = 0;
  let hh = 0;
  let engaged = false;
  let listening = false;

  const write = (x: number, y: number, lx: number, ly: number) => {
    root.style.setProperty("--mx", `${x.toFixed(2)}px`);
    root.style.setProperty("--my", `${y.toFixed(2)}px`);
    root.style.setProperty("--lx", `${lx.toFixed(2)}px`);
    root.style.setProperty("--ly", `${ly.toFixed(2)}px`);
  };

  const release = () => {
    if (!engaged) return;
    engaged = false;
    root.removeAttribute("data-magnet");
    write(0, 0, 0, 0);
  };

  const invalidate = () => {
    measured = false;
    release();
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (!measured) {
      // The root never moves (only its inner plate does), so this rect is true.
      const rect = root.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      hw = rect.width / 2;
      hh = rect.height / 2;
      measured = true;
    }
    magnetPull(event.clientX - cx, event.clientY - cy, hw, hh, strength, radius, pull);
    if (!pull.active) {
      release();
      return;
    }
    if (!engaged) {
      engaged = true;
      root.setAttribute("data-magnet", "on");
    }
    write(pull.x, pull.y, pull.labelX, pull.labelY);
  };

  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) {
      window.addEventListener("pointermove", onMove, { passive: true });
      // A scroll moves the button under a resting pointer: let go, re-measure on the next move.
      window.addEventListener("scroll", invalidate, { passive: true });
      window.addEventListener("resize", invalidate);
      document.documentElement.addEventListener("pointerleave", release);
      return;
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("scroll", invalidate);
    window.removeEventListener("resize", invalidate);
    document.documentElement.removeEventListener("pointerleave", release);
    invalidate();
  };

  // Listen only while the button is on screen.
  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) listen(entry.isIntersecting);
    });
    observer.observe(root);
  } else {
    listen(true);
  }
  const resizeObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : null;
  resizeObserver?.observe(root);

  return () => {
    observer?.disconnect();
    resizeObserver?.disconnect();
    listen(false);
    write(0, 0, 0, 0);
  };
}

export default function MagneticButton({
  href,
  onClick,
  variant,
  size = "md",
  strength = 0.25,
  radius = 80,
  icon,
  children,
  external,
  type = "button",
  disabled,
  className,
  ref,
  ...rest
}: MagneticButtonProps) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement | null>(null);

  const setRoot = useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) (ref as { current: HTMLElement | null }).current = node;
    },
    [ref]
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node || reduced || disabled || !hasFinePointer()) return;
    return attachMagnet(node, strength, radius);
  }, [reduced, disabled, strength, radius]);

  const body = (
    <span className="mb-body">
      <span className="mb-label">
        <span className="mb-text">{children}</span>
        {icon ? <Glyph name={icon} size={size === "lg" ? 20 : 16} tone="current" /> : null}
      </span>
    </span>
  );

  const shared = {
    ...rest,
    className: cx("mb", className),
    "data-variant": variant,
    "data-size": size,
  };

  if (href !== undefined) {
    const handleClick = onClick as ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
    if (external || isExternal(href)) {
      return (
        <a
          {...shared}
          ref={setRoot}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
        >
          {body}
        </a>
      );
    }
    if (href.startsWith("#")) {
      return (
        <a {...shared} ref={setRoot} href={href} onClick={handleClick}>
          {body}
        </a>
      );
    }
    return (
      <Link {...shared} ref={setRoot} href={href} onClick={handleClick}>
        {body}
      </Link>
    );
  }

  return (
    <button {...shared} ref={setRoot} type={type} disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}
