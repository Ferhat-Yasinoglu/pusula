"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { usePrefersReducedMotion } from "../../landingMotion";
import Glyph from "./Glyph";
import { burstParticles, cx } from "./primitiveKit";
import "./primitives.css";

/**
 * The install chip: mono 15 `$ npx pusula` on a `--bezel` plate with a copy
 * glyph. Copying uses the shared `copyToClipboard` (HTTPS and plain-HTTP
 * deployments alike). On success the glyph turns into a check, a visually
 * hidden polite live region says "Copied", and twelve gold sparks burst from
 * the glyph (DOM spans, transform and opacity only, 600ms; none under reduced
 * motion). It all reverts after 1800ms.
 *
 * `label` turns it into a compact copy button for terminals: the label is
 * shown instead of the command, and `size="sm"` keeps a 44px hit area around
 * a 36px plate.
 */

export type CopyChipProps = {
  text: string;
  /** Shown before the command (default "$"; "" for none). */
  prefix?: string;
  /** Show this instead of the command (the copied text is still `text`). */
  label?: string;
  size?: "md" | "sm";
  /** Accessible name (default "Copy: {text}"); a terminal names what it copies instead. */
  ariaLabel?: string;
  /** Called after a successful copy (a Terminal completes its typing). */
  onCopied?: () => void;
  className?: string;
};

const REVERT_MS = 1800;
const BURST_MS = 600;
const SPARKS = burstParticles(12);

export default function CopyChip({
  text,
  prefix = "$",
  label,
  size = "md",
  ariaLabel,
  onCopied,
  className,
}: CopyChipProps) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const [copied, setCopied] = useState(false);
  /** Increments per copy so a second click restarts the burst. */
  const [burst, setBurst] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    []
  );

  const copy = async () => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    for (const id of timers.current) window.clearTimeout(id);
    setCopied(true);
    if (!reduced) setBurst((n) => n + 1);
    onCopied?.();
    timers.current = [
      window.setTimeout(() => setCopied(false), REVERT_MS),
      window.setTimeout(() => setBurst(0), BURST_MS),
    ];
  };

  const actionLabel = ariaLabel ?? `${t("copy")}: ${text}`;

  // The live region sits beside the button, not inside it: a button's
  // children are presentational, and some screen readers skip live regions there.
  return (
    <>
      <button
        type="button"
        className={cx("cc", className)}
        data-size={size}
        data-copied={copied ? "" : undefined}
        onClick={copy}
        aria-label={actionLabel}
        title={actionLabel}
      >
        {label ? (
          <span className="cc-label">{copied ? t("copied") : label}</span>
        ) : (
          <code className="cc-text" dir="ltr">
            {prefix ? <span className="cc-prefix">{prefix} </span> : null}
            <span className="cc-cmd">{text}</span>
          </code>
        )}
        <span className="cc-icon">
          <Glyph key={copied ? "check" : "copy"} name={copied ? "check" : "copy"} size={16} />
          {burst > 0 ? (
            <span key={burst} className="cc-burst" aria-hidden="true">
              {SPARKS.map((spark, i) => (
                <span
                  key={i}
                  className="cc-spark"
                  style={
                    {
                      "--a": `${spark.angle}deg`,
                      "--d": `${spark.distance}px`,
                      "--s": `${spark.size}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          ) : null}
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}
