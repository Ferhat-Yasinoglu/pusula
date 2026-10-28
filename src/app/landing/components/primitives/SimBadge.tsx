import { useTranslations } from "next-intl";
import { cx } from "./primitiveKit";
import "./primitives.css";

/**
 * The disclosure every simulated depiction carries: an ember dot and the mono
 * word "Simulation" (`simBadge`) on a pill, with an optional note beside it in
 * `--mist-dim`. It is plain text, read in place by screen readers; the dot is
 * decoration and breathes slowly (still under reduced motion).
 *
 * No client hooks: usable from server and client components alike.
 */

export type SimBadgeProps = {
  note?: string;
  className?: string;
};

export default function SimBadge({ note, className }: SimBadgeProps) {
  const t = useTranslations("landing");
  return (
    <span className={cx("sim-badge", className)}>
      <span className="sim-pill">
        <span className="sim-dot" aria-hidden="true" />
        {t("simBadge")}
      </span>
      {note ? <span className="sim-note">{note}</span> : null}
    </span>
  );
}
