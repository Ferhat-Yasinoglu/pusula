/**
 * Inline style `page.tsx` renders first, before the intro gate script.
 *
 * Chromium paints after parsing only the head and the first few kilobytes of
 * the body, before `.pusula-landing` (and so `landing.css`'s
 * `:root:has(.pusula-landing)` rules) exists. Without this the first frame is
 * the app's light background and its `body::before` grid for 150–300 ms. The
 * colour is the landing's `--void` token (pinned by a test). A plain `<style>`
 * without `precedence` stays where React renders it and is removed when the
 * visitor navigates away, so the dashboard keeps its own background.
 */
export const FIRST_PAINT_STYLE =
  ":root,body{background:#040405;color-scheme:dark}body::before{content:none}";
