/**
 * The landing page's visual vocabulary (spec §3.4). Sections import from here
 * or straight from the component files; both work. Only what the stations use
 * is re-exported, so the dead-code gate stays honest.
 */
export { default as Station } from "./Station";
export { default as Needle } from "./Needle";
export { default as LiveNumber } from "./LiveNumber";
export type { LiveNumberHandle } from "./LiveNumber";
export { default as SplitFlap } from "./SplitFlap";
export { default as TypeLine } from "./TypeLine";
export type { TypeLineHandle, TypeLineProps, TypeToken } from "./TypeLine";
export { default as Terminal } from "./Terminal";
export type { TerminalHandle, TerminalTab } from "./Terminal";
export { default as WordReveal } from "./WordReveal";
export { default as MagneticButton } from "./MagneticButton";
export { default as CopyChip } from "./CopyChip";
export { default as SimBadge } from "./SimBadge";
export { default as Toggle } from "./Toggle";
export { default as Segmented } from "./Segmented";
export { default as Glyph, GLYPH_NAMES } from "./Glyph";
