"use client";
import type { ReactNode } from "react";

/**
 * Section opener: a short teal rule, the title in sentence case, one lead
 * paragraph. No caps eyebrow, no numbering — numbering is reserved for the
 * one real sequence on the page (Get started).
 */
export default function SectionHeading({
  id,
  title,
  lead,
  aside,
}: {
  id?: string;
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="rule-mark max-w-2xl">
        <h2 id={id} className="section-title text-[var(--foam)]">
          {title}
        </h2>
        {lead ? <p className="lead mt-4">{lead}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
