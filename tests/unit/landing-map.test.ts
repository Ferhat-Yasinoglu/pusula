import test from "node:test";
import assert from "node:assert/strict";
import {
  BORDER_POINTS,
  CITIES,
  CITY_POINTS,
  MAP_HEIGHT,
  MAP_WIDTH,
  pointInPolygon,
} from "../../src/app/landing/landingGeometry.ts";
import { SAMPLE_CANDIDATES } from "../../src/app/landing/landingTypes.ts";
import { CANDIDATE_IDS } from "../../src/app/landing/sim/sampleTable.ts";
import { makeCamera, project3 } from "../../src/app/landing/sim/landingProjection.ts";
import {
  CANDIDATE_OF_CITY,
  CATALOG_ID,
  CITY_COUNT,
  EDGE_VERTICES,
  HEAT_CAP,
  HUB_ARCS,
  HUB_INDEX,
  LABEL_SIDE,
  MAP_CANDIDATES,
  MAP_FITS,
  NODE_COUNT,
  NODE_POINTS,
  PASSIVE_NODES,
  PERSPECTIVE_F,
  PROVIDER_CITY,
  PROVIDER_NODES,
  cityAt,
  cityRole,
  clientNode,
  decayHeat,
  emptyLeg,
  fitMap,
  flatNodePoint,
  flowPitch,
  kickHeat,
  legDurationMs,
  logKind,
  mapFitId,
  nearestNode,
  packCandidate,
  pillarHeight,
  pinCameraTarget,
  planFlight,
  providerNode,
  shortHeader,
  tiltFrame,
  unpackDown,
  unpackState,
} from "../../src/app/landing/components/map/mapRoles.ts";

const legs = () => Array.from({ length: 6 }, emptyLeg);

test("map roles: Kabul is the hub, six provider cities, two client cities", () => {
  assert.equal(cityRole("kabul"), "hub");
  assert.equal(CITIES[HUB_INDEX].id, "kabul");
  const providers = CITIES.filter((city) => cityRole(city.id) === "provider").map((c) => c.id);
  assert.deepEqual(providers.sort(), [
    "bamyan",
    "herat",
    "jalalabad",
    "kandahar",
    "kunduz",
    "mazar",
  ]);
  assert.equal(cityRole("ghazni"), "client");
  assert.equal(cityRole("faizabad"), "client");
});

test("map roles: the spec's city → provider mapping, onto the real catalog ids", () => {
  assert.deepEqual(PROVIDER_CITY, {
    claude: "mazar",
    gpt: "herat",
    gemini: "kandahar",
    glm: "kunduz",
    cerebras: "jalalabad",
    ollama: "bamyan",
  });
  // Every deck candidate has exactly one city, and the inverse map agrees.
  assert.deepEqual([...MAP_CANDIDATES].sort(), [...CANDIDATE_IDS].sort());
  for (const id of MAP_CANDIDATES) assert.equal(CANDIDATE_OF_CITY[PROVIDER_CITY[id]], id);
  // Labels print the catalog id from landingTypes (gpt → openai, ollama → ollama-local).
  for (const c of SAMPLE_CANDIDATES) assert.equal(CATALOG_ID[c.id], c.catalogId);
  assert.equal(CATALOG_ID.gpt, "openai");
  assert.equal(CATALOG_ID.ollama, "ollama-local");
});

test("map nodes: nine cities then four edge vertices on the border", () => {
  assert.equal(CITY_COUNT, 9);
  assert.equal(NODE_COUNT, 13);
  for (let i = 0; i < CITY_COUNT; i++) assert.deepEqual(NODE_POINTS[i], CITY_POINTS[CITIES[i].id]);
  assert.equal(EDGE_VERTICES.length, 4);
  assert.equal(
    clientNode("ghazni"),
    CITIES.findIndex((c) => c.id === "ghazni")
  );
  assert.equal(
    clientNode("faizabad"),
    CITIES.findIndex((c) => c.id === "faizabad")
  );
  assert.deepEqual(
    (["edge0", "edge1", "edge2", "edge3"] as const).map(clientNode),
    [9, 10, 11, 12]
  );
  assert.equal(
    providerNode("claude"),
    CITIES.findIndex((c) => c.id === "mazar")
  );
});

test("map arcs: one lifted arc from Kabul to every other node, apex .35 × chord", () => {
  assert.equal(HUB_ARCS[HUB_INDEX], null);
  const hub = NODE_POINTS[HUB_INDEX];
  for (let node = 0; node < NODE_COUNT; node++) {
    if (node === HUB_INDEX) continue;
    const arc = HUB_ARCS[node];
    assert.ok(arc);
    assert.deepEqual([arc.ax, arc.ay], [hub.x, hub.y]);
    assert.deepEqual([arc.bx, arc.by], [NODE_POINTS[node].x, NODE_POINTS[node].y]);
    assert.ok(Math.abs(arc.apex - 0.35 * arc.chord) < 1e-9);
  }
  assert.equal(legDurationMs(0), 700);
  assert.equal(legDurationMs(100), 840);
});

test("flight plan: client → Kabul → provider when nothing failed", () => {
  const out = legs();
  const n = planFlight(out, clientNode("ghazni"), [], [], providerNode("claude"));
  assert.equal(n, 2);
  assert.equal(out[0].inbound, true);
  assert.equal(out[0].tint, "client");
  assert.equal(out[0].delayMs, 0);
  assert.equal(out[1].inbound, false);
  assert.equal(out[1].tint, "provider");
  assert.equal(out[1].final, true);
  assert.equal(out[1].code, 0);
  assert.equal(out[1].delayMs, out[0].durationMs);
});

test("flight plan: a fallback departs from Kabul when the failure lands (no relay)", () => {
  const out = legs();
  const herat = providerNode("gpt");
  const kandahar = providerNode("gemini");
  const n = planFlight(out, clientNode("edge2"), [herat], [503], kandahar);
  assert.equal(n, 3);
  // Every outbound leg runs on a hub arc: the hub retries, never the failed city.
  assert.equal(out[1].node, herat);
  assert.equal(out[1].code, 503);
  assert.equal(out[1].final, false);
  assert.equal(out[2].node, kandahar);
  assert.equal(out[2].tint, "fallback");
  assert.equal(out[2].final, true);
  assert.equal(out[2].delayMs, out[1].delayMs + out[1].durationMs);
});

test("flight plan: a dropped request ends on its last failure; the pool caps legs", () => {
  const out = legs();
  const n = planFlight(
    out,
    clientNode("faizabad"),
    [providerNode("claude"), providerNode("gpt")],
    [503, 429],
    -1
  );
  assert.equal(n, 3);
  assert.equal(out[2].code, 429);
  assert.equal(
    out.some((leg, i) => i < n && leg.final),
    false
  );
  const tiny = [emptyLeg(), emptyLeg()];
  assert.equal(planFlight(tiny, 0, [1, 2, 3], [503, 503, 503], 4), 2);
});

test("heat: 3 s half-life, +.35 per arrival capped at 1.6, pillar heights", () => {
  assert.ok(Math.abs(decayHeat(1, 3) - 0.5) < 1e-12);
  assert.equal(decayHeat(0.8, 0), 0.8);
  assert.ok(Math.abs(kickHeat(0) - 0.35) < 1e-12);
  assert.equal(kickHeat(1.5), HEAT_CAP);
  assert.equal(pillarHeight(0), 2);
  assert.equal(pillarHeight(1), 28);
  assert.equal(pillarHeight(1.6), 28);
});

test("framing: fit by width or height, title top-left and board at the bottom inline-end", () => {
  const wide = fitMap(1440, 900, "pin");
  assert.ok(Math.abs(wide.scale - Math.min(0.78 * 1440, (0.8 * 900 * 825) / 643) / 825) < 1e-9);
  assert.equal(wide.cx, 1440 * 0.58);
  assert.equal(wide.cy, 900 * 0.56);
  // RTL: the board takes the bottom-left (the SimDock is bottom-right), so the map leans further right.
  assert.equal(mapFitId(1440, "pin", true), "pinRtl");
  assert.ok(fitMap(1440, 900, "pin", true).cx > wide.cx);
  // 1024–1279: smaller and further right, clear of the title and the board.
  assert.equal(mapFitId(1279, "pin", false), "compact");
  assert.equal(mapFitId(1280, "pin", false), "pin");
  const compact = fitMap(1024, 768, "pin");
  assert.ok(Math.abs(compact.cx - 1024 * 0.62) < 1e-9);
  assert.ok(Math.abs(compact.scale - Math.min(0.66 * 1024, (0.8 * 768 * 825) / 643) / 825) < 1e-9);
  assert.equal(mapFitId(1024, "pin", true), "compactRtl");
  assert.equal(mapFitId(1440, "flow", true), "flow");
  const phone = fitMap(390, 1000, "flow");
  assert.ok(Math.abs(phone.scale - (MAP_FITS.flow.w * 390) / MAP_WIDTH) < 1e-9);
  // The flat (poster) position of a city is the pitch-0 canvas projection.
  const cam = makeCamera({
    yaw: 0,
    pitch: 0,
    F: PERSPECTIVE_F,
    cx: wide.cx,
    cy: wide.cy,
    scale: wide.scale,
  });
  const out = new Float32Array(4);
  for (let node = 0; node < CITY_COUNT; node++) {
    const p = NODE_POINTS[node];
    project3(cam, p.x - MAP_WIDTH / 2, p.y - MAP_HEIGHT / 2, 0, out, 0);
    const flat = flatNodePoint(node, wide);
    assert.ok(Math.abs(out[0] - flat.x) < 1e-3);
    assert.ok(Math.abs(out[1] - flat.y) < 1e-3);
  }
});

test("framing: the tilt frame is the identity when flat and grows the phone map 14% when tilted", () => {
  const base = fitMap(390, 290, "flow");
  const flat = tiltFrame(base, 390, 290, "flow", 0, { scale: 0, cx: 0, cy: 0 });
  assert.deepEqual(flat, base);
  const tilted = tiltFrame(base, 390, 290, "flow", 1, { scale: 0, cx: 0, cy: 0 });
  assert.ok(Math.abs(tilted.scale - base.scale * 1.14) < 1e-9);
  assert.ok(tilted.cy < base.cy);
  const pinned = tiltFrame(fitMap(1440, 900, "pin"), 1440, 900, "pin", 2, {
    scale: 0,
    cx: 0,
    cy: 0,
  });
  assert.ok(Math.abs(pinned.cy - (900 * 0.56 + 900 * 0.03)) < 1e-9);
});

test("hit test: nearest node of a set within the radius, else −1", () => {
  const screen = new Float32Array([10, 10, 1, 0, 100, 100, 1, 0, 40, 10, 1, 0]);
  assert.equal(nearestNode(screen, [0, 1, 2], 12, 11, 24), 0);
  assert.equal(nearestNode(screen, [0, 1, 2], 30, 10, 24), 2);
  assert.equal(nearestNode(screen, [0, 1, 2], 300, 300, 24), -1);
  assert.equal(nearestNode(screen, [0], 40, 10, 24), -1);
});

test("hit test: only the six provider cities take a tap; the hub never steals one", () => {
  assert.equal(PROVIDER_NODES.length, 6);
  assert.deepEqual(
    [...PROVIDER_NODES, ...PASSIVE_NODES].sort((a, b) => a - b),
    [...Array(CITY_COUNT).keys()]
  );
  assert.ok(!PROVIDER_NODES.includes(HUB_INDEX));
  // Kabul and Jalalabad 29px apart, as on a 390px phone.
  const screen = new Float32Array(CITY_COUNT * 4).fill(-1000);
  const jalalabad = providerNode("cerebras");
  screen[HUB_INDEX * 4] = 200;
  screen[HUB_INDEX * 4 + 1] = 150;
  screen[jalalabad * 4] = 229;
  screen[jalalabad * 4 + 1] = 150;
  // A tap 10px from Kabul (19px from Jalalabad) cuts Jalalabad's road, never selects Kabul.
  assert.equal(cityAt(screen, 210, 150, false), jalalabad);
  assert.equal(cityAt(screen, 210, 150, true), jalalabad);
  // Out of every provider's reach, a tap does nothing; a hover still finds the hub.
  assert.equal(cityAt(screen, 196, 150, false), -1);
  assert.equal(cityAt(screen, 196, 150, true), HUB_INDEX);
});

test("camera: flat reference look at p = 0, fully tilted from p = .5, phone tilt over 1.6 s", () => {
  const deg = Math.PI / 180;
  const flat = pinCameraTarget(0);
  assert.equal(flat.pitch, 0);
  assert.equal(Math.abs(flat.yaw), 0);
  const half = pinCameraTarget(0.5);
  assert.ok(Math.abs(half.pitch - 52 * deg) < 1e-9);
  assert.ok(Math.abs(half.yaw + 10 * deg) < 1e-9);
  assert.deepEqual(pinCameraTarget(1), half);
  const quarter = pinCameraTarget(0.25);
  assert.ok(quarter.pitch > 0 && quarter.pitch < half.pitch);
  assert.equal(flowPitch(0), 0);
  assert.ok(Math.abs(flowPitch(1600) - 46 * deg) < 1e-9);
  assert.ok(Math.abs(flowPitch(9999) - 46 * deg) < 1e-9);
});

test("labels: every city has a side in both layouts", () => {
  for (const city of CITIES) {
    assert.match(LABEL_SIDE.pin[city.id], /^[nsew]$/);
    assert.match(LABEL_SIDE.flow[city.id], /^[nsew]$/);
    assert.equal(LABEL_SIDE.pin[city.id], city.label);
  }
});

test("breaker packing round-trips latch and state for all six candidates", () => {
  let packed = 0;
  const states = ["closed", "degraded", "halfOpen", "open", "open", "closed"] as const;
  states.forEach((state, i) => {
    packed |= packCandidate(i, i % 2 === 1, state);
  });
  states.forEach((state, i) => {
    assert.equal(unpackState(packed, i), state);
    assert.equal(unpackDown(packed, i), i % 2 === 1);
  });
  assert.equal(packCandidate(0, false, "closed"), 0);
});

test("the flight board shortens the real fallback header", () => {
  assert.equal(shortHeader("X-Pusula-Fallback-Attempts"), "Fallback-Attempts");
});

test("flight board lines: served, served after a retry, or dropped (never a bare arrow)", () => {
  assert.equal(logKind(0, true), "ok");
  assert.equal(logKind(2, true), "fallback");
  assert.equal(logKind(0, false), "dropped");
  assert.equal(logKind(3, false), "dropped");
});

test("edge vertices sit on the country's border", () => {
  for (let i = CITY_COUNT; i < NODE_COUNT; i++) {
    const p = NODE_POINTS[i];
    const onVertex = BORDER_POINTS.some((b) => b.x === p.x && b.y === p.y);
    assert.ok(onVertex, `edge ${i - CITY_COUNT} is a border vertex`);
  }
  // And every city is inside it.
  for (let i = 0; i < CITY_COUNT; i++) assert.ok(pointInPolygon(NODE_POINTS[i], BORDER_POINTS));
});
