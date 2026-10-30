"use client";
import {
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type AnimationEvent,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { canAnimate } from "../../runtime/heartbeat";
import { cx, splitWords, watchView, whenIntroHandoff } from "./primitiveKit";
import "./primitives.css";

/**
 * A heading (or paragraph) whose words rise into place one after another:
 * each word goes from `translateY(.45em)` and opacity .001 to rest over
 * 700ms `--ease-out`, `stagger` ms apart. Opacity starts at .001, not 0, so
 * the text stays a Largest Contentful Paint candidate.
 *
 * - Words come from `Intl.Segmenter` (never graphemes, so Persian joining is
 *   intact) and are split during render, identically on server and client.
 * - The hidden start exists only under `.pusula-landing[data-motion="on"]`,
 *   never under reduced motion or Pause. Until JavaScript takes over, a CSS
 *   failsafe (`data-wr="armed"`) reveals the words after 5s by itself.
 * - `trigger="view"` plays when the element is on screen; `trigger="intro"`
 *   waits for the intro's `pusula:intro-handoff` event, or plays at once when
 *   no intro is running.
 * - The element stays one accessible heading: when every line is plain text
 *   it carries the whole text as `aria-label` and the word spans are hidden
 *   from assistive technology (the split-text pattern screen readers handle).
 *
 * Only `data-wr` changes after mount, and only imperatively; React renders it
 * as the constant "armed", so a re-render never restarts the reveal.
 */

export type WordRevealProps = {
  as: "h1" | "h2" | "p";
  /** One entry per visual line. Strings are split into words; other nodes reveal as one unit. */
  lines: readonly ReactNode[];
  /** ms between consecutive words (default 55). */
  stagger?: number;
  /** ms before the first word (default 0). */
  delay?: number;
  trigger?: "view" | "intro";
} & Omit<HTMLAttributes<HTMLHeadingElement>, "children">;

type Piece = { key: string; node: ReactNode; space: boolean; index: number };

/** Share of the element that must be visible before a `view` reveal plays. */
const VIEW_THRESHOLD = 0.35;

function splitLines(lines: readonly ReactNode[], locale: string): Piece[][] {
  let index = 0;
  return lines.map((line, li) => {
    const pieces: Piece[] = [];
    const addNode = (node: ReactNode, key: string) => {
      if (node === null || node === undefined || typeof node === "boolean") return;
      if (typeof node === "string" || typeof node === "number") {
        splitWords(String(node), locale).forEach((part, pi) => {
          pieces.push({
            key: `${key}.${pi}`,
            node: part.text,
            space: part.space,
            index: part.space ? -1 : index++,
          });
        });
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((child, ci) => addNode(child as ReactNode, `${key}.${ci}`));
        return;
      }
      pieces.push({
        key: isValidElement(node) && node.key !== null ? `${key}.k${node.key}` : key,
        node,
        space: false,
        index: index++,
      });
    };
    addNode(line, `l${li}`);
    return pieces;
  });
}

function plainText(lines: readonly ReactNode[]): string | undefined {
  const parts: string[] = [];
  for (const line of lines) {
    if (typeof line === "string" || typeof line === "number") parts.push(String(line));
    else return undefined;
  }
  return parts.join(" ");
}

export default function WordReveal({
  as: Tag,
  lines,
  stagger = 55,
  delay = 0,
  trigger = "view",
  className,
  style,
  ...rest
}: WordRevealProps) {
  const locale = useLocale();
  const rootRef = useRef<HTMLHeadingElement>(null);

  const split = useMemo(() => splitLines(lines, locale), [lines, locale]);
  // Headings take the whole text as their name; a paragraph cannot be named.
  const label = useMemo(() => (Tag === "p" ? undefined : plainText(lines)), [Tag, lines]);
  const lastIndex = useMemo(
    () => split.reduce((max, line) => line.reduce((m, p) => Math.max(m, p.index), max), -1),
    [split]
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    // Reduced motion or Pause at mount: show everything, never hide.
    if (!canAnimate()) {
      node.setAttribute("data-wr", "done");
      return;
    }
    // JavaScript owns the hidden start from here (the CSS failsafe stands down).
    node.setAttribute("data-wr", "wait");
    const play = () => node.setAttribute("data-wr", canAnimate() ? "play" : "done");
    if (trigger === "intro") return whenIntroHandoff(play);
    let played = false;
    return watchView(node, {
      enterThreshold: VIEW_THRESHOLD,
      onEnter: () => {
        if (played) return;
        played = true;
        play();
      },
    });
  }, [trigger]);

  // Once the last word has landed the reveal is over; "done" keeps a later
  // style change (display toggles, re-parenting) from replaying it.
  const onAnimationEnd = (event: AnimationEvent<HTMLHeadingElement>) => {
    rest.onAnimationEnd?.(event);
    const target = event.target as HTMLElement;
    if (
      event.animationName === "wr-rise" &&
      target.dataset.wrLast === "1" &&
      rootRef.current?.getAttribute("data-wr") === "play"
    ) {
      rootRef.current.setAttribute("data-wr", "done");
    }
  };

  const vars = {
    ...style,
    "--wr-stagger": `${stagger}ms`,
    "--wr-delay": `${delay}ms`,
  } as CSSProperties;

  return (
    <Tag
      {...rest}
      ref={rootRef}
      className={cx("wr", className)}
      style={vars}
      data-wr="armed"
      aria-label={rest["aria-label"] ?? label}
      onAnimationEnd={onAnimationEnd}
    >
      {split.map((pieces, li) => (
        <span key={li} className="wr-line" aria-hidden={label !== undefined ? true : undefined}>
          {pieces.map((piece) =>
            piece.space ? (
              piece.node
            ) : (
              <span
                key={piece.key}
                className="wr-w"
                style={{ "--i": piece.index } as CSSProperties}
                data-wr-last={piece.index === lastIndex ? "1" : undefined}
              >
                {piece.node}
              </span>
            )
          )}
        </span>
      ))}
    </Tag>
  );
}
