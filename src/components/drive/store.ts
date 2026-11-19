import { useSyncExternalStore } from "react";
import type { SectionId } from "@/data/portfolio";
import { aheadDistance, FORK_S, ROAD_WIDTH, routes, type Checkpoint, type Route, type RouteId } from "./track";

/* ---------------- Simulation: mutable, read every frame, never triggers React renders ---------------- */

export const keys = { gas: false, brake: false, left: false, right: false };

export const sim = {
  s: 0, // arc-length position on the current route
  v: 0, // speed, units/s (negative = reverse)
  lat: 0, // sideways offset from the centre line
  latV: 0, // sideways velocity, for the steering visual
  route: null as RouteId | null, // null until the car passes the fork
  // A checkpoint stays disarmed until the car leaves its zone, so closing a panel never re-opens it.
  disarmed: null as SectionId | null,
  boardT: 0, // seconds since "Get in" was pressed
};

/** Screen position for the avatar's speech bubble, written by the 3D scene each frame. */
export const bubbleAnchor = { x: 0, y: 0, on: false };

/** Before the fork both routes are identical, so Express stands in. */
export const currentRoute = (): Route => routes[sim.route ?? "express"];

const MAX = 34, REVERSE = -8, ACCEL = 15, BRAKE = 34, DRAG = 4;
export const ZONE = 34; // auto-brake starts this far before a checkpoint
const STOP_AT = 2.5, STEER = 9, LAT_MAX = ROAD_WIDTH / 2 - 1.4;
export const BOARD_SECONDS = 2.2; // walk to the car, get in, camera swings behind

/* ---------------- UI state: small, immutable, subscribed to with useSyncExternalStore ---------------- */

export type Status = "pending" | "visited" | "skipped";
export type Phase = "intro" | "boarding" | "driving";
type UI = {
  phase: Phase;
  route: RouteId | null;
  open: SectionId | null;
  approaching: SectionId | null;
  status: Record<SectionId, Status>;
  lap: number;
};

const freshStatus = () => Object.fromEntries(routes.express.checkpoints.map((c) => [c.id, "pending"])) as Record<SectionId, Status>;
let ui: UI = { phase: "intro", route: null, open: null, approaching: null, status: freshStatus(), lap: 1 };
const listeners = new Set<() => void>();

function set(patch: Partial<UI>) {
  ui = { ...ui, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
export const useUI = <T,>(pick: (u: UI) => T) => useSyncExternalStore(subscribe, () => pick(ui), () => pick(ui));
export const getUI = () => ui;

export const actions = {
  /** "Get in": the avatar walks to the car; driving starts when boarding finishes. */
  board() {
    if (ui.phase !== "intro") return;
    sim.boardT = 0;
    set({ phase: "boarding" });
  },
  skipIntro: () => set({ phase: "driving" }),
  open(id: SectionId) {
    sim.v = 0;
    sim.disarmed = id;
    set({ open: id, approaching: null, status: { ...ui.status, [id]: "visited" } });
  },
  close: () => set({ open: null }),
  /** Fast travel from the checkpoint list: jump to the stop on the current route and open it. */
  travel(id: SectionId) {
    if (!sim.route) setRoute("express");
    const cp = currentRoute().checkpoints.find((c) => c.id === id)!;
    sim.s = cp.s - STOP_AT;
    sim.lat = 0;
    if (ui.phase !== "driving") set({ phase: "driving" });
    actions.open(id);
  },
};

function setRoute(r: RouteId | null) {
  sim.route = r;
  set({ route: r });
}

/* ---------------- One physics tick ---------------- */

export function step(dt: number) {
  dt = Math.min(dt, 1 / 20); // a backgrounded tab must not teleport the car
  if (ui.phase === "boarding") {
    sim.boardT += dt;
    if (sim.boardT >= BOARD_SECONDS) set({ phase: "driving" });
    return;
  }
  if (ui.phase !== "driving" || ui.open) {
    sim.v = 0;
    // Pressing gas while a section is open closes it and drives on.
    if (ui.open && keys.gas) actions.close();
    return;
  }
  const route = currentRoute();

  // Nearest checkpoint ahead within the zone (none before the fork).
  let next: Checkpoint | null = null, dist = Infinity;
  if (sim.route) for (const c of route.checkpoints) {
    const d = aheadDistance(route, sim.s, c.s);
    if (d > -STOP_AT && d < dist) { dist = d; next = c; }
  }
  if (sim.disarmed && (!next || next.id !== sim.disarmed || dist > ZONE)) sim.disarmed = null;
  const inZone = !!next && dist < ZONE && next.id !== sim.disarmed && ui.status[next.id] !== "visited";

  if (keys.gas) sim.v += ACCEL * dt;
  if (keys.brake) sim.v -= (sim.v > 0 ? BRAKE : ACCEL * 0.6) * dt;
  const drag = (DRAG + 0.012 * sim.v * sim.v) * dt;
  sim.v = Math.abs(sim.v) <= drag ? 0 : sim.v - Math.sign(sim.v) * drag;

  // Auto-brake into a checkpoint unless the driver keeps the gas down (= skip it).
  if (inZone && !keys.gas && sim.v > 0) {
    const room = Math.max(dist - STOP_AT, 0.01);
    const need = (sim.v * sim.v) / (2 * room); // constant decel that stops exactly at the line
    sim.v = Math.max(0, sim.v - Math.max(need, 6) * dt);
    if (room < 1.2 || sim.v < 0.6) return actions.open(next!.id);
  }
  sim.v = Math.min(MAX, Math.max(REVERSE, sim.v));
  // No reversing back past the start before a route is chosen.
  if (!sim.route && sim.s <= 0 && sim.v < 0) sim.v = 0;

  const target = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  sim.latV += (target * STEER * Math.min(1, Math.abs(sim.v) / 6) - sim.latV) * Math.min(1, dt * 6);
  sim.lat = Math.max(-LAT_MAX, Math.min(LAT_MAX, sim.lat + sim.latV * dt));

  const prev = sim.s;
  sim.s += sim.v * dt;

  // The fork: whichever half of the road you're on picks the route. Left = Express, right = Scenic.
  if (!sim.route && prev < FORK_S && sim.s >= FORK_S) setRoute(sim.lat > 0 ? "scenic" : "express");
  // Reversing back through the fork un-chooses it.
  else if (sim.route && prev >= FORK_S && sim.s < FORK_S && sim.s > 0) setRoute(null);

  if (sim.route) for (const c of route.checkpoints) {
    const before = aheadDistance(route, prev, c.s), after = aheadDistance(route, sim.s, c.s);
    if (before > 0 && after <= 0 && ui.status[c.id] === "pending") set({ status: { ...ui.status, [c.id]: "skipped" } });
  }

  // Lap complete: back on the shared straight, choose again; skipped stops get another chance.
  if (sim.s >= route.length) {
    sim.s -= route.length;
    const status = { ...ui.status };
    for (const k in status) if (status[k as SectionId] === "skipped") status[k as SectionId] = "pending";
    sim.route = null;
    set({ lap: ui.lap + 1, status, route: null });
  } else if (sim.s < 0 && sim.route) sim.s += route.length;

  const approaching = inZone ? next!.id : null;
  if (approaching !== ui.approaching) set({ approaching });
}
