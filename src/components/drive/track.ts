import { CatmullRomCurve3, Vector3 } from "three";
import { sections, type SectionId } from "@/data/portfolio";

export const ROAD_WIDTH = 9;

/*
 * Two closed loops that share the start straight. Catmull-Rom segment P0→P1 depends only on
 * P(-1), P0, P1, P2, so sharing those four points makes the first stretch identical on both routes.
 * They split at P1 (the fork): Express bends left (−z), Scenic bends right (+z).
 * The car drives +x from the origin; its "right" is +z.
 */
const SHARED_TAIL: [number, number] = [-60, 0];
const SHARED_HEAD: [number, number][] = [[0, 0], [70, 0]];

const EXPRESS: [number, number][] = [
  ...SHARED_HEAD, [130, -38], [172, -105], [140, -178], [72, -168], [30, -222],
  [-40, -240], [-108, -196], [-92, -130], [-146, -84], [-118, -26], SHARED_TAIL,
];
const SCENIC: [number, number][] = [
  ...SHARED_HEAD, [130, 38], [205, 58], [262, 130], [240, 222], [160, 258], [96, 330],
  [0, 362], [-92, 322], [-132, 240], [-78, 182], [-152, 118], [-174, 50], [-122, 14], SHARED_TAIL,
];

export type RouteId = "express" | "scenic";
/** `plotLat` = sideways offset of the building plot, chosen so it clears every road. */
export type Checkpoint = { id: SectionId; label: string; index: number; s: number; side: 1 | -1; plotLat: number };
type F = { pos: Vector3; fwd: Vector3; right: Vector3 };
export type Route = {
  id: RouteId;
  curve: CatmullRomCurve3;
  length: number;
  samples: Vector3[];
  checkpoints: Checkpoint[];
};

export const SAMPLES = 900;
/** Arc length of the shared straight; the fork is here (~3 s of driving from rest). */
export let FORK_S = 0;

function build(id: RouteId, pts: [number, number][]): Route {
  const curve = new CatmullRomCurve3(pts.map(([x, z]) => new Vector3(x, 0, z)), true, "centripetal", 0.5);
  const length = curve.getLength();
  // Arc length P0→P1 = length fraction of the first segment
  FORK_S = curve.getLengths(pts.length * 50)[50];
  // Stops sit after the fork and leave room before the loop closes.
  const first = FORK_S + 60, span = length - first - 90;
  return {
    id, curve, length,
    samples: curve.getSpacedPoints(SAMPLES),
    checkpoints: sections.map((sec, i) => ({ id: sec.id, label: sec.label, index: i, s: first + (span * i) / (sections.length - 1), side: i % 2 ? -1 : 1, plotLat: 0 })),
  };
}

export const routes: Record<RouteId, Route> = { express: build("express", EXPRESS), scenic: build("scenic", SCENIC) };

const UP = new Vector3(0, 1, 0);
const wrap = (r: Route, s: number) => ((s % r.length) + r.length) % r.length;

/** Position, forward and right vectors at distance `s` on a route, shifted sideways by `lateral`. */
export function frameAt(r: Route, s: number, lateral = 0, out: F = { pos: new Vector3(), fwd: new Vector3(), right: new Vector3() }) {
  const u = wrap(r, s) / r.length;
  r.curve.getPointAt(u, out.pos);
  r.curve.getTangentAt(u, out.fwd);
  out.right.crossVectors(out.fwd, UP).normalize();
  out.pos.addScaledVector(out.right, lateral);
  return out;
}

/** Signed turn rate at s: positive = turning right. Used for body roll. */
const a = new Vector3(), b = new Vector3();
export function turnAt(r: Route, s: number) {
  const u = wrap(r, s) / r.length;
  r.curve.getTangentAt(u, a);
  r.curve.getTangentAt((u + 4 / r.length) % 1, b);
  return a.x * b.z - a.z * b.x;
}

/** Forward distance from s to cs on a loop, in [−L/2, L/2). */
export function aheadDistance(r: Route, s: number, cs: number) {
  let d = (cs - s) % r.length;
  if (d < -r.length / 2) d += r.length;
  if (d >= r.length / 2) d -= r.length;
  return d;
}

/** Everything from the fork onward on Scenic (the shared straight is drawn once, by Express). */
export const startS = (id: RouteId) => (id === "scenic" ? FORK_S : 0);

/*
 * Put each building where it clears *every* road: the loop doubling back and the other route
 * both pass close to some stops. Try the preferred side first, then further out, then the other side.
 */
const PLOT_R = 13;
const CLEAR = PLOT_R + ROAD_WIDTH / 2 + 4;
const allSamples = [...routes.express.samples, ...routes.scenic.samples];
const clearOfRoads = (p: Vector3) => allSamples.every((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 > CLEAR ** 2);
for (const r of Object.values(routes)) {
  for (const cp of r.checkpoints) {
    const tries = [22, 26, 30, 36, 44, 54].flatMap((d) => [cp.side * d, -cp.side * d]);
    const lat = tries.find((l) => clearOfRoads(frameAt(r, cp.s, l).pos));
    if (lat === undefined) throw new Error(`No clear plot for ${r.id}/${cp.id}: move it along the road`);
    cp.plotLat = lat;
    cp.side = lat > 0 ? 1 : -1;
  }
}
