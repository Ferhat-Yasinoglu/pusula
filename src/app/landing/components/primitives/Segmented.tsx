"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./primitiveKit";
import "./primitives.css";

/**
 * A segmented control with radio semantics (`role="radiogroup"` of
 * `role="radio"` buttons): one tab stop, arrow keys move the choice and the
 * focus together (mirrored in RTL), Home and End jump to the ends. The chosen
 * segment's plate fades and settles in by opacity and transform only. Every
 * segment is at least 44px tall.
 */

export type SegmentedOption = { id: string; label: ReactNode };

export type SegmentedProps = {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** The group's accessible name (a radiogroup needs one). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

export default function Segmented({
  options,
  value,
  onChange,
  className,
  ...labelling
}: SegmentedProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((option) => option.id === value);
  const focusable = selected >= 0 ? selected : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = options.length;
    if (count === 0) return;
    // Read in the handler, not in a loop: the visual direction of this group.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
        next = rtl ? index - 1 : index + 1;
        break;
      case "ArrowLeft":
        next = rtl ? index + 1 : index - 1;
        break;
      case "ArrowDown":
        next = index + 1;
        break;
      case "ArrowUp":
        next = index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    next = (next + count) % count;
    buttons.current[next]?.focus();
    onChange(options[next].id);
  };

  return (
    <div role="radiogroup" className={cx("seg", className)} {...labelling}>
      {options.map((option, i) => (
        <button
          key={option.id}
          ref={(node) => {
            buttons.current[i] = node;
          }}
          type="button"
          role="radio"
          className="seg-opt"
          aria-checked={option.id === value}
          tabIndex={i === focusable ? 0 : -1}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => onKeyDown(event, i)}
        >
          <span className="seg-label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
