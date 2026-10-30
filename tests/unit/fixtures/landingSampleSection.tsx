"use client";
/**
 * A landing section written the way a section engineer writes one (the usage
 * in the foundation API reference): a pinned `Station` whose stage is a canvas
 * over a poster, deck readouts through `useDeck`, a dom-lane loop, scroll
 * progress and a needle that follows the page heading. Rendered on the server
 * by `tests/unit/landing-foundation.test.ts`.
 */
import { useRef } from "react";
import {
  LiveNumber,
  Needle,
  SimBadge,
  Station,
} from "../../../src/app/landing/components/primitives";
import { getWorld, useDeck, useReqPerSec } from "../../../src/app/landing/runtime/deckStore";
import { useScrollProgress } from "../../../src/app/landing/runtime/scrollProgress";
import { useHeadingRef } from "../../../src/app/landing/runtime/stations";
import { useCanvasStage } from "../../../src/app/landing/runtime/useCanvasStage";
import { useDomLoop } from "../../../src/app/landing/runtime/useDomLoop";
import type { World } from "../../../src/app/landing/sim/landingSim";

/* Module-level selectors: a stable identity lets `useDeck` cache the selection. */
const selectWinner = (w: World) => w.featured.winner;
const selectRouted = (w: World) => w.totals.routed;

export default function LandingSampleSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(trackRef, { mode: "pin", minWidth: 1024 });
  const heading = useHeadingRef();
  const winner = useDeck(selectWinner);
  const routed = useDeck(selectRouted);
  const reqPerSec = useReqPerSec();
  useDomLoop("sample-loop", () => void getWorld().totals.routed, { target: panelRef });
  const { wrapRef, canvasRef } = useCanvasStage({
    id: "sample-stage",
    draw: (ctx, s) => ctx.clearRect(0, 0, s.w * progress.current, s.h),
  });

  return (
    <Station id="network" title="Map" pin={{ minWidth: 1024, vh: 160 }} trackRef={trackRef}>
      <div ref={panelRef} className="station-inner">
        <SimBadge />
        <Needle size={28} angleRef={heading} />
        <output data-winner={winner}>{winner}</output>
        <LiveNumber value={routed} mode="tick" />
        <span data-rate={reqPerSec} />
      </div>
      <div ref={wrapRef} className="stage">
        <div className="stage-poster" />
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
    </Station>
  );
}
