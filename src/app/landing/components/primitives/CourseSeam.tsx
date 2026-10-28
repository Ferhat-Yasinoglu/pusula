"use client";
import { useEffect, useRef } from "react";
import Glyph from "./Glyph";
import { cx } from "./primitiveKit";
import "./primitives.css";

/**
 * The rhumb line that opens every station: a full-width 1px hairline with an
 * eight-point star 24px from the inline start, turned to the station's
 * bearing. It sits absolutely inside the station's top padding, so it adds no
 * height.
 *
 * Alive: when the seam scrolls into view a 120px gold pulse runs along it,
 * then again every 9s (`--loop-seam`) while it stays visible. The run is a
 * pure CSS `translateX` keyframe that only exists while `data-live="on"`, so
 * each arrival restarts it from the start and an off-screen seam costs
 * nothing. In RTL the whole seam mirrors, so the pulse runs from the right.
 */

export type CourseSeamProps = {
  bearing: number;
  className?: string;
};

export default function CourseSeam({ bearing, className }: CourseSeamProps) {
  const seamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = seamRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) node.setAttribute("data-live", "on");
      else node.removeAttribute("data-live");
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={seamRef} className={cx("seam", className)} data-bearing={bearing} aria-hidden="true">
      <div className="seam-track">
        <div className="seam-run">
          <span className="seam-pulse" />
        </div>
      </div>
      <span className="seam-star">
        <Glyph name="star8" size={16} style={{ transform: `rotate(${bearing}deg)` }} />
      </span>
    </div>
  );
}
