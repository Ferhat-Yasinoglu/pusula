"use client";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, register, usePaused } from "../../runtime/heartbeat";
import { cx, typeSlices, typedAt, watchView } from "./primitiveKit";
import "./primitives.css";

/**
 * A line that types itself. The server and the first client render show the
 * whole text (hydration-identical, readable without JavaScript); after mount,
 * when motion is allowed and the line comes into view, the text is cleared
 * just below the fold and typed out once it is on screen.
 *
 * Typing never renders per-character spans: a cursor walks the precomputed
 * token list and writes `textContent` slices into the few token spans, on the
 * heartbeat's `dom` lane. Clicking the line or copying from it completes it at
 * once, and so do reduced motion and Pause.
 *
 * - `startOn="view"` (default) types on first view and again whenever
 *   `restartKey` changes after that.
 * - `startOn="manual"` types only when `restartKey` changes or `play()` is
 *   called (a `Terminal` sequences its lines this way).
 */

export type TypeTokenClass = "kw" | "str" | "num" | "accent";
export type TypeToken = { t: string; c?: TypeTokenClass };

export type TypeLineHandle = {
  /** Clear the line, ready to type (no-op when motion is not allowed). */
  reset(): void;
  /** Type the line from the start (completes at once when motion is not allowed). */
  play(): void;
  /** Show the whole line now. */
  complete(): void;
};

export type TypeLineProps = {
  /** The line's text; also what is typed when `tokens` is absent. */
  text: string;
  /** Coloured segments; when given they are what is shown and typed. */
  tokens?: readonly TypeToken[];
  /** Characters per second (default 90). */
  cps?: number;
  startOn?: "view" | "manual";
  /** Blinking block caret after the text. */
  caret?: boolean;
  /** Any change retypes the line. */
  restartKey?: unknown;
  /** Called when a typing run finishes (also when it is completed early). */
  onDone?: () => void;
  /** Stable identity of the line inside a `Terminal` (used as its key). */
  id?: string;
  className?: string;
  ref?: Ref<TypeLineHandle>;
};

type Phase = "idle" | "armed" | "typing";

type Live = {
  phase: Phase;
  elapsed: number;
  typed: number;
  seen: boolean;
  unregister: () => void;
};

const noop = () => {};
const EMPTY = new Int32Array(0);

export default function TypeLine({
  text,
  tokens,
  cps = 90,
  startOn = "view",
  caret = false,
  restartKey,
  onDone,
  className,
  ref,
}: TypeLineProps) {
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const parts = useMemo<readonly TypeToken[]>(
    () => (tokens && tokens.length > 0 ? tokens : [{ t: text }]),
    [tokens, text]
  );
  const strings = useMemo(() => parts.map((part) => part.t), [parts]);
  const total = useMemo(() => strings.reduce((sum, s) => sum + s.length, 0), [strings]);

  const rootRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<Live>({
    phase: "idle",
    elapsed: 0,
    typed: -1,
    seen: false,
    unregister: noop,
  });
  const slicesRef = useRef<Int32Array>(EMPTY);
  const nextRef = useRef<Int32Array>(EMPTY);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  /** Write the first `typed` units of the line into the token spans. */
  const writeTyped = useCallback(
    (typed: number) => {
      const root = rootRef.current;
      if (!root) return;
      // Two buffers, reused: what each span shows now, and what it should show.
      if (slicesRef.current.length !== strings.length) {
        slicesRef.current = new Int32Array(strings.length).fill(-1);
        nextRef.current = new Int32Array(strings.length);
      }
      const shown = slicesRef.current;
      const next = nextRef.current;
      typeSlices(strings, typed, next);
      const spans = root.children;
      for (let i = 0; i < strings.length; i++) {
        const visible = next[i];
        if (visible === shown[i]) continue;
        shown[i] = visible;
        const span = spans[i];
        if (!span || !span.classList.contains("tl-t")) continue;
        span.textContent = visible >= strings[i].length ? strings[i] : strings[i].slice(0, visible);
      }
      liveRef.current.typed = typed;
    },
    [strings]
  );

  const stop = useCallback(() => {
    const live = liveRef.current;
    live.unregister();
    live.unregister = noop;
  }, []);

  const complete = useCallback(() => {
    const live = liveRef.current;
    const wasTyping = live.phase === "typing";
    stop();
    if (live.phase !== "idle") {
      // Force a full rewrite: React's own text may be stale after our slices.
      slicesRef.current.fill(-1);
      writeTyped(total);
    }
    live.phase = "idle";
    rootRef.current?.removeAttribute("data-typing");
    if (wasTyping) onDoneRef.current?.();
  }, [stop, writeTyped, total]);

  const reset = useCallback(() => {
    if (!canAnimate()) return;
    const live = liveRef.current;
    stop();
    live.phase = "armed";
    live.elapsed = 0;
    writeTyped(0);
    rootRef.current?.setAttribute("data-typing", "armed");
  }, [stop, writeTyped]);

  const play = useCallback(() => {
    if (!canAnimate()) {
      complete();
      return;
    }
    const live = liveRef.current;
    stop();
    live.phase = "typing";
    live.elapsed = 0;
    writeTyped(0);
    rootRef.current?.setAttribute("data-typing", "on");
    if (total === 0) {
      complete();
      return;
    }
    live.unregister = register({
      id: "type-line",
      lane: "dom",
      tick: (dt) => {
        live.elapsed += dt * 1000;
        const typed = typedAt(live.elapsed, cps, total);
        if (typed !== live.typed) writeTyped(typed);
        if (typed >= total) complete();
      },
    });
  }, [stop, complete, writeTyped, total, cps]);

  useImperativeHandle(ref, () => ({ reset, play, complete }), [reset, play, complete]);

  // `startOn="view"`: clear just below the fold, type once on screen.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || startOn !== "view") return;
    return watchView(node, {
      onNear: () => {
        if (!liveRef.current.seen && liveRef.current.phase === "idle") reset();
      },
      onFar: () => {
        if (!liveRef.current.seen && liveRef.current.phase === "armed") complete();
      },
      onEnter: () => {
        if (liveRef.current.seen) return;
        liveRef.current.seen = true;
        play();
      },
    });
  }, [startOn, reset, play, complete]);

  // A new restartKey retypes (view lines only once they have been seen).
  const keyRef = useRef(restartKey);
  useEffect(() => {
    if (Object.is(keyRef.current, restartKey)) return;
    keyRef.current = restartKey;
    if (startOn === "manual" || liveRef.current.seen) play();
  }, [restartKey, startOn, play]);

  // New text mid-run: React rewrote the changed spans, so re-slice from scratch.
  const stringsRef = useRef(strings);
  useEffect(() => {
    if (stringsRef.current === strings) return;
    stringsRef.current = strings;
    slicesRef.current = EMPTY;
    const live = liveRef.current;
    if (live.phase === "typing") complete();
    else if (live.phase === "armed") writeTyped(0);
  }, [strings, complete, writeTyped]);

  // Reduced motion or Pause: the whole line, now.
  useEffect(() => {
    if (reduced || paused) complete();
  }, [reduced, paused, complete]);

  useEffect(() => stop, [stop]);

  return (
    <span ref={rootRef} className={cx("tl", className)} onClick={complete} onCopy={complete}>
      {parts.map((part, i) => (
        <span key={i} className={cx("tl-t", part.c && `tl-${part.c}`)}>
          {part.t}
        </span>
      ))}
      {caret ? <span className="tl-caret" aria-hidden="true" /> : null}
    </span>
  );
}
