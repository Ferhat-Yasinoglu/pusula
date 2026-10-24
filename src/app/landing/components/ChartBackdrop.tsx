"use client";

/**
 * Fixed backdrop: the faint rings and bearing lines of a chart, centred where
 * the hero instrument sits. Decoration with one job — to make the whole page
 * read as one navigation surface — so it stays at a few percent opacity and
 * never animates.
 */
export default function ChartBackdrop() {
  const rings = [220, 340, 480, 640, 820, 1040];
  const bearings = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const cx = 1180;
  const cy = 420;
  const length = 1400;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 78% 22%, rgba(15,143,131,0.16), transparent 60%), radial-gradient(700px 500px at 12% 90%, rgba(15,143,131,0.08), transparent 60%)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 1000"
        preserveAspectRatio="xMidYMin slice"
        fill="none"
      >
        <g stroke="#2ED3C4" strokeOpacity="0.07" strokeWidth="1">
          {rings.map((r) => (
            <circle key={r} cx={cx} cy={cy} r={r} />
          ))}
          {bearings.map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            // Rounded so the server and client render byte-identical attributes.
            const round2 = (value: number) => Math.round(value * 100) / 100;
            return (
              <line
                key={deg}
                x1={round2(cx + Math.cos(rad) * 200)}
                y1={round2(cy + Math.sin(rad) * 200)}
                x2={round2(cx + Math.cos(rad) * length)}
                y2={round2(cy + Math.sin(rad) * length)}
              />
            );
          })}
        </g>
      </svg>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,26,32,0) 0%, rgba(6,26,32,0) 55%, rgba(6,26,32,0.85) 100%)",
        }}
      />
    </div>
  );
}
