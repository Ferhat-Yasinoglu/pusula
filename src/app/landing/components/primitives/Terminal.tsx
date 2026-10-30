"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useTranslations } from "next-intl";
import { canAnimate } from "../../runtime/heartbeat";
import CopyChip from "./CopyChip";
import TypeLine, { type TypeLineHandle, type TypeLineProps } from "./TypeLine";
import { cx, watchView } from "./primitiveKit";
import "./primitives.css";

/**
 * A terminal window: `--deck` panel, three window dots, a title, optional
 * tabs, a copy chip at the inline end, and a `<pre>` of `TypeLine`s. Code is
 * always `dir="ltr"` and mono 13 (12 on a phone); only the `<pre>` scrolls
 * horizontally, never the page.
 *
 * The terminal types its lines one after another when it first comes into
 * view (cleared just below the fold, typed once on screen), and again when
 * `activeTab` or `restartKey` changes. A single line whose own `restartKey`
 * changes retypes on its own. Clicking the code, copying from it or using the
 * copy chip completes everything at once. Reduced motion and Pause never type.
 *
 * Tabs follow the WAI-ARIA tabs pattern (`role="tablist"`, automatic
 * activation, arrow keys, Home and End); the `<pre>` is the tab panel.
 */

export type TerminalTab = { id: string; label: string };

export type TerminalHandle = {
  /** Clear every line and type them again in order. */
  replay(): void;
  /** Show every line now. */
  complete(): void;
};

export type TerminalProps = {
  title: string;
  tabs?: readonly TerminalTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  lines: readonly TypeLineProps[];
  /** Text the copy chip copies; no chip without it. */
  copyText?: string;
  /** Any change retypes every line. */
  restartKey?: unknown;
  /** Accessible name of the code region (defaults to `title`). */
  ariaLabel?: string;
  /** Rendered under the code, inside the panel (e.g. a Run button). */
  footer?: ReactNode;
  className?: string;
  ref?: Ref<TerminalHandle>;
};

export default function Terminal({
  title,
  tabs,
  activeTab,
  onTab,
  lines,
  copyText,
  restartKey,
  ariaLabel,
  footer,
  className,
  ref,
}: TerminalProps) {
  const t = useTranslations("landing");
  const baseId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<(TypeLineHandle | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sequenceRef = useRef({ active: false, cursor: -1, seen: false });
  const countRef = useRef(lines.length);
  useEffect(() => {
    countRef.current = lines.length;
  });

  const completeAll = useCallback(() => {
    sequenceRef.current.active = false;
    for (const handle of handlesRef.current) handle?.complete();
  }, []);

  const resetAll = useCallback(() => {
    for (const handle of handlesRef.current) handle?.reset();
  }, []);

  const typeFrom = useCallback((index: number) => {
    const sequence = sequenceRef.current;
    const handle = handlesRef.current[index];
    if (index >= countRef.current || !handle) {
      sequence.active = false;
      return;
    }
    sequence.active = true;
    sequence.cursor = index;
    handle.play();
  }, []);

  const replay = useCallback(() => {
    if (!canAnimate()) {
      completeAll();
      return;
    }
    sequenceRef.current.active = false;
    resetAll();
    typeFrom(0);
  }, [completeAll, resetAll, typeFrom]);

  const lineDone = useCallback(
    (index: number) => {
      const sequence = sequenceRef.current;
      if (!sequence.active || sequence.cursor !== index) return;
      typeFrom(index + 1);
    },
    [typeFrom]
  );

  useImperativeHandle(ref, () => ({ replay, complete: completeAll }), [replay, completeAll]);

  // First view: clear just below the fold, type in order once on screen.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    return watchView(node, {
      onNear: () => {
        if (!sequenceRef.current.seen && canAnimate()) resetAll();
      },
      onFar: () => {
        if (!sequenceRef.current.seen) completeAll();
      },
      onEnter: () => {
        if (sequenceRef.current.seen) return;
        sequenceRef.current.seen = true;
        replay();
      },
    });
  }, [resetAll, completeAll, replay]);

  // A new tab or restartKey retypes everything (once the terminal has been seen).
  const keyRef = useRef<[unknown, unknown]>([activeTab, restartKey]);
  useEffect(() => {
    const [tab, key] = keyRef.current;
    if (Object.is(tab, activeTab) && Object.is(key, restartKey)) return;
    keyRef.current = [activeTab, restartKey];
    if (sequenceRef.current.seen) replay();
  }, [activeTab, restartKey, replay]);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!tabs || tabs.length === 0) return;
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    onTab?.(tabs[next].id);
  };

  const hasTabs = !!tabs && tabs.length > 0;
  const activeIndex = hasTabs
    ? Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTab)
      )
    : -1;
  const panelId = `${baseId}-code`;
  const tabId = (i: number) => `${baseId}-tab-${i}`;

  return (
    <div
      ref={panelRef}
      className={cx("term", className)}
      dir="ltr"
      data-tabs={hasTabs ? "" : undefined}
    >
      <div className="term-bar">
        <span className="term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="term-title">{title}</span>
        {hasTabs ? (
          <div className="term-tabs" role="tablist" aria-label={ariaLabel ?? title}>
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[i] = node;
                }}
                id={tabId(i)}
                type="button"
                role="tab"
                className="term-tab"
                aria-selected={i === activeIndex}
                aria-controls={panelId}
                tabIndex={i === activeIndex ? 0 : -1}
                onClick={() => onTab?.(tab.id)}
                onKeyDown={(event) => onTabKey(event, i)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        {copyText !== undefined ? (
          <span className="term-end">
            <CopyChip
              text={copyText}
              label={t("copy")}
              size="sm"
              ariaLabel={`${t("copy")}: ${ariaLabel ?? title}`}
              onCopied={completeAll}
            />
          </span>
        ) : null}
      </div>
      <pre
        id={panelId}
        className="term-pre"
        tabIndex={0}
        role={hasTabs ? "tabpanel" : "group"}
        aria-labelledby={hasTabs ? tabId(activeIndex) : undefined}
        aria-label={hasTabs ? undefined : (ariaLabel ?? title)}
        onClick={completeAll}
        onCopy={completeAll}
      >
        <code>
          {lines.map((line, i) => (
            <Fragment key={line.id ?? i}>
              {i > 0 ? "\n" : null}
              <TypeLine
                {...line}
                startOn="manual"
                ref={(handle) => {
                  handlesRef.current[i] = handle;
                }}
                onDone={() => {
                  line.onDone?.();
                  lineDone(i);
                }}
              />
            </Fragment>
          ))}
        </code>
      </pre>
      {footer ? <div className="term-foot">{footer}</div> : null}
    </div>
  );
}
