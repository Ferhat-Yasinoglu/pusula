"use client";
import type { ReactNode } from "react";
import Glyph, { type GlyphName } from "./Glyph";
import { cx } from "./primitiveKit";
import "./primitives.css";

/**
 * A latching switch: `<button aria-pressed>` with a small track whose knob is
 * also its LED. Pressed, the knob snaps across on the detent ease
 * (`--ease-detent`, `--t-toggle`) and lights ember with a glow that fades in
 * by opacity alone. The knob travels towards the inline end, so it mirrors in
 * RTL. 44px tall; the whole pill is the target.
 *
 * Used for the resilience fault latches, the bench's "Lossless only" and the
 * Pause control.
 */

export type ToggleProps = {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  label: ReactNode;
  glyph?: GlyphName;
  /** Keep the label for assistive technology only (an icon-sized control). */
  hideLabel?: boolean;
  disabled?: boolean;
  title?: string;
  id?: string;
  className?: string;
};

export default function Toggle({
  pressed,
  onChange,
  label,
  glyph,
  hideLabel = false,
  disabled,
  title,
  id,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      className={cx("tg", hideLabel && "tg-compact", className)}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!pressed)}
    >
      <span className="tg-track" aria-hidden="true">
        <span className="tg-knob" />
      </span>
      {glyph ? <Glyph name={glyph} size={16} /> : null}
      <span className={hideLabel ? "sr-only" : "tg-label"}>{label}</span>
    </button>
  );
}
