/**
 * The landing page's visual vocabulary (spec §3.4). Sections import from here
 * or straight from the component files; both work.
 */
export { default as Station, PIN_BREAKPOINTS, pinBreakpoint } from "./Station";
export type { StationProps } from "./Station";
export { default as CourseSeam } from "./CourseSeam";
export type { CourseSeamProps } from "./CourseSeam";
export { default as Needle } from "./Needle";
export type { NeedleProps } from "./Needle";
export { default as LiveNumber } from "./LiveNumber";
export type { LiveNumberHandle, LiveNumberProps } from "./LiveNumber";
export { default as SplitFlap } from "./SplitFlap";
export type { SplitFlapHandle, SplitFlapProps } from "./SplitFlap";
export { default as TypeLine } from "./TypeLine";
export type { TypeLineHandle, TypeLineProps, TypeToken, TypeTokenClass } from "./TypeLine";
export { default as Terminal } from "./Terminal";
export type { TerminalHandle, TerminalProps, TerminalTab } from "./Terminal";
export { default as WordReveal } from "./WordReveal";
export type { WordRevealProps } from "./WordReveal";
export { default as MagneticButton } from "./MagneticButton";
export type { MagneticButtonProps } from "./MagneticButton";
export { default as CopyChip } from "./CopyChip";
export type { CopyChipProps } from "./CopyChip";
export { default as SimBadge } from "./SimBadge";
export type { SimBadgeProps } from "./SimBadge";
export { default as Toggle } from "./Toggle";
export type { ToggleProps } from "./Toggle";
export { default as Segmented } from "./Segmented";
export type { SegmentedOption, SegmentedProps } from "./Segmented";
export { default as Glyph, GLYPH_NAMES, DIRECTIONAL_GLYPHS } from "./Glyph";
export type { GlyphName, GlyphProps, GlyphSize } from "./Glyph";
export { INTRO_HANDOFF_EVENT } from "./primitiveKit";
