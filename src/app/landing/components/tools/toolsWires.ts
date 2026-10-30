/**
 * The patch bay's cable layout, measured from the DOM (spec §6.7).
 *
 * `measureWires` reads the rig's boxes once per resize and routes every
 * cable: dressed through the bay's gutters into the hub beside it ("tray"),
 * hung straight down into the hub under it ("drop"), or a seven-line funnel
 * from the phone's chip cloud ("funnel"); then the trunk on to the terminal.
 * It also fills the arc-length lookup tables the pulses ride, so the frame
 * loop never measures anything. The geometry itself lives in `toolsRig.ts`.
 */
import {
  FUNNEL_LINES,
  LUT_STRIDE,
  bayColumns,
  dropCable,
  fillPathLut,
  nearestLine,
  pathData,
  spanCable,
  spreadAnchors,
  trayCables,
  type CablePath,
  type Cubic,
  type TrayJack,
} from "./toolsRig";

export type WireMode = "tray" | "drop" | "funnel";

export type Wires = {
  w: number;
  h: number;
  mode: WireMode;
  /** Path data per cable: one per tool (tray and drop) or per funnel line. */
  cables: readonly string[];
  trunk: string;
  /** Per tool: the cable that carries its pulses and highlight (−1 when hidden). */
  lineOf: readonly number[];
};

/** The rig's parts whose boxes the layout is measured from. */
export type WireParts = {
  rig: HTMLElement;
  bay: HTMLElement;
  /** The jack list: every `[data-jack]` holds a `[data-socket]` and a `[data-led]`. */
  list: HTMLElement;
  hub: HTMLElement;
  hubCol: HTMLElement;
  hubText: HTMLElement | null;
  term: HTMLElement;
};

export type WireLayout = {
  wires: Wires;
  /** Arc-length lookup tables, `LUT_STRIDE` floats per cable, the trunk last. */
  lut: Float32Array;
  /** Each cable's length in px, the trunk last. */
  lens: Float32Array;
  /** The jacks' LEDs, in jack order. */
  leds: HTMLElement[];
};

/** The dial's rim radius as a share of the hub box (viewBox 120, rim r 58). */
const RIM = 58 / 120;

/** Route every cable and the trunk in rig coordinates; null while the rig has no size. */
export function measureWires({
  rig,
  bay,
  list,
  hub,
  hubCol,
  hubText,
  term,
}: WireParts): WireLayout | null {
  const rr = rig.getBoundingClientRect();
  if (rr.width === 0 || rr.height === 0) return null;
  const ox = rr.left;
  const oy = rr.top;
  const funnel = getComputedStyle(rig).getPropertyValue("--tools-wire").trim() === "funnel";
  const hb = hub.getBoundingClientRect();
  const hx = hb.left + hb.width / 2 - ox;
  const hy = hb.top + hb.height / 2 - oy;
  const hr = hb.width * RIM;
  const br = bay.getBoundingClientRect();

  const jacks = Array.from(list.querySelectorAll<HTMLElement>("[data-jack]"));
  const leds: HTMLElement[] = [];
  const paths: CablePath[] = [];
  const lineOf: number[] = [];
  for (const jack of jacks) {
    const led = jack.querySelector<HTMLElement>("[data-led]");
    if (led) leds.push(led);
  }

  let mode: WireMode;
  if (funnel) {
    mode = "funnel";
    const top = br.bottom - oy;
    const anchors = spreadAnchors(br.left - ox, br.right - ox, FUNNEL_LINES, 28);
    for (const ax of anchors) paths.push([dropCable(ax, top, hx, hb.top - oy + 14)]);
    for (const jack of jacks) {
      const r = jack.getBoundingClientRect();
      lineOf.push(r.width === 0 ? -1 : nearestLine(anchors, r.left + r.width / 2 - ox));
    }
  } else if (hb.top >= br.bottom - 1) {
    // The hub under the bay: cables hang straight down behind the plates
    // and drop into the dial's top, fanned a little along its rim.
    mode = "drop";
    const midX = br.left + br.width / 2 - ox;
    const fan = hb.height * 0.22;
    jacks.forEach((jack, i) => {
      const r = jack.querySelector<HTMLElement>("[data-socket]")?.getBoundingClientRect();
      if (!r || r.width === 0) {
        lineOf.push(-1);
        paths.push([]);
        return;
      }
      const sx = r.left + r.width / 2 - ox;
      const sy = r.top + r.height / 2 - oy;
      const inX = hx + Math.max(-fan, Math.min(fan, (sx - midX) * 0.12));
      lineOf.push(i);
      paths.push([dropCable(sx, sy, inX, hb.top - oy + 14)]);
    });
  } else {
    // The hub beside the bay: cables dressed through the gutters (see trayCables).
    mode = "tray";
    const side: 1 | -1 = hx > br.left + br.width / 2 - ox ? 1 : -1;
    const cols = bayColumns(jacks.length);
    const rows = Math.ceil(jacks.length / cols);
    const rowTop = new Array<number>(rows).fill(Infinity);
    const rowBottom = new Array<number>(rows).fill(-Infinity);
    const trayJacks: TrayJack[] = [];
    let gridEdge = side === 1 ? -Infinity : Infinity;
    jacks.forEach((jack, i) => {
      const plate = jack.getBoundingClientRect();
      const socket = jack.querySelector<HTMLElement>("[data-socket]")?.getBoundingClientRect();
      if (plate.width === 0 || !socket || socket.width === 0) {
        trayJacks.push({ x: 0, y: 0, row: -1 });
        return;
      }
      const row = Math.floor(i / cols);
      rowTop[row] = Math.min(rowTop[row], plate.top - oy);
      rowBottom[row] = Math.max(rowBottom[row], plate.bottom - oy);
      gridEdge =
        side === 1 ? Math.max(gridEdge, plate.right - ox) : Math.min(gridEdge, plate.left - ox);
      // The cable leaves from the top of the plug seated in the socket.
      const plug = socket.height * 0.18;
      trayJacks.push({
        x: socket.left + socket.width / 2 - ox,
        y: socket.top + socket.height / 2 - plug - oy,
        row,
      });
    });
    const gap = rows > 1 ? rowTop[1] - rowBottom[0] : 12;
    const trayY = rowTop.map((top, r) => (r === 0 ? top - gap / 2 : (rowBottom[r - 1] + top) / 2));
    const routed = trayCables({
      side,
      jacks: trayJacks,
      trayY,
      gridEdge,
      bayEdge: side === 1 ? br.right - ox : br.left - ox,
      hub: { x: hx, y: hy, r: hr },
    });
    routed.forEach((path, i) => {
      paths.push(path);
      lineOf.push(path.length > 0 ? i : -1);
    });
  }

  // The trunk: hub → terminal, beside it (either side: RTL mirrors) or below it.
  const tb = term.getBoundingClientRect();
  const tl = tb.left - ox;
  const tr = tb.right - ox;
  const tt = tb.top - oy;
  const ty = Math.min(Math.max(hy, tt + 64), tb.bottom - oy - 64);
  let trunk: Cubic;
  if (tl >= hb.right - ox - 1) trunk = spanCable(hb.right - ox - 10, hy, tl + 1, ty);
  else if (tr <= hb.left - ox + 1) trunk = spanCable(hb.left - ox + 10, hy, tr - 1, ty);
  else {
    // Straight down: from the dial when its caption sits beside it, else from under the caption.
    const text = hubText?.getBoundingClientRect();
    const besideDial = !!text && text.top < hb.bottom - 2;
    const from = besideDial ? hb.bottom - oy - 6 : hubCol.getBoundingClientRect().bottom - oy + 2;
    trunk = dropCable(hx, from, hx, tt + 1);
  }

  const lut = new Float32Array((paths.length + 1) * LUT_STRIDE);
  const lens = new Float32Array(paths.length + 1);
  paths.forEach((path, i) => {
    lens[i] = fillPathLut(path, lut, i * LUT_STRIDE);
  });
  lens[paths.length] = fillPathLut([trunk], lut, paths.length * LUT_STRIDE);

  return {
    wires: {
      w: Math.round(rr.width),
      h: Math.round(rr.height),
      mode,
      cables: paths.map((path) => pathData(path)),
      trunk: pathData([trunk]),
      lineOf,
    },
    lut,
    lens,
    leds,
  };
}
