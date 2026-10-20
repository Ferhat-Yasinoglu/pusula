/**
 * Pusula logo SVG — a compass: ring, four cardinal ticks and a needle whose
 * amber half points north-east (the chosen route). Matches the favicon and
 * the app icon; everything but the amber needle half follows `currentColor`.
 */
type PusulaLogoProps = {
  size?: number;
  className?: string;
};

export default function PusulaLogo({ size = 20, className = "" }: PusulaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      suppressHydrationWarning
    >
      {/* Compass ring */}
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="1.4" />
      {/* Cardinal ticks */}
      <line
        x1="16"
        y1="8.1"
        x2="16"
        y2="6.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="23.9"
        x2="16"
        y2="25.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="8.1"
        y1="16"
        x2="6.5"
        y2="16"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="23.9"
        y1="16"
        x2="25.5"
        y2="16"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Needle: amber half points north-east, the trailing half follows currentColor */}
      <path d="M21.4 10.6 L17.4 17.4 L14.6 14.6 Z" fill="#F59E0B" />
      <path d="M10.6 21.4 L14.6 14.6 L17.4 17.4 Z" fill="currentColor" fillOpacity="0.9" />
      {/* Pivot */}
      <circle cx="16" cy="16" r="0.9" fill="currentColor" />
    </svg>
  );
}
