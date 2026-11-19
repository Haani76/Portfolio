"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { frameAt, ROAD_WIDTH, routes, SAMPLES, startS, turnAt, type Checkpoint, type Route } from "./track";
import { currentRoute, getUI, sim, step, useUI } from "./store";
import { Avatar } from "./Avatar";

// Editorial palette, kept in sync with globals.css
const C = { paper: "#f4efe6", paper2: "#e9e1d2", ink: "#1b1a17", mute: "#6b665c", red: "#e8452c", blue: "#1f3fff", green: "#0e8a6d", white: "#fbf8f2" };

/* ---------------- Flat ground layers ----------------
 * Ground, shoulders, asphalt and paint all lie within a few cm of y=0. Depth-testing them against
 * each other z-fights (flicker), and where two routes overlap they'd fight at identical heights.
 * So they skip depth writes and are painted in a fixed order instead, like layers on paper.
 * Everything standing on them still depth-tests normally. DoubleSide covers strips that fold on tight bends.
 */
const LAYER = { ground: -10, plot: -9, shoulderScenic: -8, shoulderExpress: -7, roadScenic: -6, roadExpress: -5, paint: -4 } as const;
const FLAT = { depthWrite: false, side: THREE.DoubleSide } as const;

/* ---------------- Road ---------------- */

const F0 = () => ({ pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() });

/*
 * Lane paint must not be drawn across the other road's asphalt where the roads split or merge.
 * Where the two centre lines coincide (shared stretch), Express owns the paint and Scenic skips it.
 * Elsewhere a paint mark is skipped if it lies on the other road.
 */
function paintSkipper(r: Route) {
  const o = routes[r.id === "express" ? "scenic" : "express"];
  const from = Math.ceil((startS(o.id) / o.length) * SAMPLES);
  const other = o.samples.slice(from);
  const minD2 = (p: THREE.Vector3) => other.reduce((m, q) => Math.min(m, (q.x - p.x) ** 2 + (q.z - p.z) ** 2), Infinity);
  const half = ROAD_WIDTH / 2;
  return (centre: THREE.Vector3, mark: THREE.Vector3) => {
    if (minD2(centre) < 1.5 ** 2) return r.id === "scenic";
    return minD2(mark) < half * half;
  };
}

/** A strip following a route from s0 to the end, `offset` from centre. `skip(centre, stripMid)` leaves gaps. */
function ribbon(r: Route, offset: number, width: number, y: number, s0 = 0, skip?: (centre: THREE.Vector3, mid: THREE.Vector3) => boolean) {
  const pos: number[] = [], idx: number[] = [];
  const f = F0();
  const n = Math.ceil(SAMPLES * (1 - s0 / r.length));
  let prevOk = false;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((r.length - s0) * i) / n;
    frameAt(r, s, 0, f);
    const l = f.pos.clone().addScaledVector(f.right, offset - width / 2);
    const rr = f.pos.clone().addScaledVector(f.right, offset + width / 2);
    pos.push(l.x, y, l.z, rr.x, y, rr.z);
    const ok = !skip?.(f.pos, l.clone().lerp(rr, 0.5));
    if (i > 0 && ok && prevOk) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } // CCW from above
    prevOk = ok;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Road({ r }: { r: Route }) {
  const s0 = startS(r.id);
  const skip = useMemo(() => paintSkipper(r), [r]);
  const { road, shoulder, edgeL, edgeR } = useMemo(() => ({
    road: ribbon(r, 0, ROAD_WIDTH, 0.02, s0),
    shoulder: ribbon(r, 0, ROAD_WIDTH + 3, 0.01, s0),
    edgeL: ribbon(r, -ROAD_WIDTH / 2 + 0.5, 0.25, 0.03, s0, skip),
    edgeR: ribbon(r, ROAD_WIDTH / 2 - 0.5, 0.25, 0.03, s0, skip),
  }), [r, s0, skip]);
  const dashes = useRef<THREE.InstancedMesh>(null);
  const count = Math.floor((r.length - s0) / 7);
  // Scenic is painted under Express where they overlap; every shoulder under every road.
  const ex = r.id === "express";

  useLayoutEffect(() => {
    const m = new THREE.Object3D(), f = F0();
    for (let i = 0; i < count; i++) {
      const s = s0 + 3 + i * 7;
      frameAt(r, s, 0, f);
      m.position.set(f.pos.x, 0.035, f.pos.z);
      m.scale.setScalar(skip(f.pos, f.pos) ? 0 : 1);
      m.rotation.set(-Math.PI / 2, Math.atan2(f.fwd.x, f.fwd.z), 0, "YXZ");
      m.updateMatrix();
      dashes.current!.setMatrixAt(i, m.matrix);
    }
    dashes.current!.instanceMatrix.needsUpdate = true;
  }, [count, r, s0, skip]);

  return (
    <group>
      <mesh geometry={shoulder} receiveShadow renderOrder={ex ? LAYER.shoulderExpress : LAYER.shoulderScenic}><meshStandardMaterial color={C.paper2} {...FLAT} /></mesh>
      <mesh geometry={road} receiveShadow renderOrder={ex ? LAYER.roadExpress : LAYER.roadScenic}><meshStandardMaterial color={C.ink} roughness={0.9} {...FLAT} /></mesh>
      <mesh geometry={edgeL} renderOrder={LAYER.paint}><meshBasicMaterial color={C.white} {...FLAT} /></mesh>
      <mesh geometry={edgeR} renderOrder={LAYER.paint}><meshBasicMaterial color={C.white} {...FLAT} /></mesh>
      <instancedMesh ref={dashes} args={[undefined, undefined, count]} renderOrder={LAYER.paint}>
        <planeGeometry args={[0.25, 3]} />
        <meshBasicMaterial color={C.white} {...FLAT} />
      </instancedMesh>
    </group>
  );
}

/* ---------------- Scenery ---------------- */

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function Trees() {
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const r = rng(7), out: { x: number; z: number; s: number }[] = [];
    // Keep clear of the road and of each landmark plot.
    const all = Object.values(routes);
    const plots = all.flatMap((rt) => rt.checkpoints.map((c) => frameAt(rt, c.s, c.plotLat).pos.clone()));
    plots.push(...BOARDS.map((b) => frameAt(routes.express, b.s, b.lat).pos.clone()));
    const samples = all.flatMap((rt) => rt.samples);
    while (out.length < 420) {
      const x = (r() - 0.5) * 620 + 40, z = (r() - 0.5) * 760 + 60;
      let ok = true;
      for (let i = 0; i < samples.length && ok; i += 3) if ((samples[i].x - x) ** 2 + (samples[i].z - z) ** 2 < 15 ** 2) ok = false;
      for (const p of plots) if ((p.x - x) ** 2 + (p.z - z) ** 2 < 18 ** 2) ok = false;
      if (ok) out.push({ x, z, s: 0.7 + r() * 1.1 });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    spots.forEach((t, i) => {
      m.position.set(t.x, 3.2 * t.s, t.z); m.scale.setScalar(t.s); m.updateMatrix();
      crowns.current!.setMatrixAt(i, m.matrix);
      m.position.y = 0.8 * t.s; m.updateMatrix();
      trunks.current!.setMatrixAt(i, m.matrix);
    });
    crowns.current!.instanceMatrix.needsUpdate = trunks.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <>
      <instancedMesh ref={crowns} args={[undefined, undefined, spots.length]} castShadow>
        <coneGeometry args={[1.8, 4.6, 7]} />
        <meshStandardMaterial color={C.green} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[0.25, 0.3, 1.6, 6]} />
        <meshStandardMaterial color={C.ink} />
      </instancedMesh>
    </>
  );
}

/* ---------------- Landmarks: one distinct building per section ---------------- */

const Box = ({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) => (
  <mesh position={p} castShadow receiveShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} flatShading />
  </mesh>
);

function Building({ id }: { id: Checkpoint["id"] }) {
  switch (id) {
    case "about": // a house: hello
      return (<>
        <Box p={[0, 3, 0]} s={[10, 6, 8]} c={C.white} />
        <mesh position={[0, 8.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[7.6, 4.4, 4]} /><meshStandardMaterial color={C.red} flatShading /></mesh>
        <Box p={[0, 1.6, 4.05]} s={[2, 3.2, 0.2]} c={C.ink} />
      </>);
    case "work": // office tower
      return (<>
        <Box p={[0, 9, 0]} s={[8, 18, 8]} c={C.blue} />
        {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[0, 2.5 + i * 2.8, 4.05]} s={[6.6, 0.5, 0.1]} c={C.white} />)}
        <Box p={[0, 18.6, 0]} s={[3, 1.2, 3]} c={C.ink} />
      </>);
    case "projects": // workshop / lab with a dish
      return (<>
        <Box p={[0, 2.5, 0]} s={[14, 5, 9]} c={C.ink} />
        <mesh position={[-3, 7, 0]} rotation={[-0.6, 0, 0]} castShadow><sphereGeometry args={[3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={C.white} side={THREE.DoubleSide} /></mesh>
        <Box p={[4, 7, 0]} s={[1, 4, 1]} c={C.red} />
      </>);
    case "edu": // columns + pediment
      return (<>
        <Box p={[0, 0.5, 0]} s={[14, 1, 9]} c={C.paper2} />
        {[-5, -1.7, 1.7, 5].map((x) => <mesh key={x} position={[x, 4.5, 3]} castShadow><cylinderGeometry args={[0.6, 0.6, 7, 12]} /><meshStandardMaterial color={C.white} /></mesh>)}
        <Box p={[0, 4.5, -1.5]} s={[12, 7, 5]} c={C.white} />
        <mesh position={[0, 9.4, 0.5]} rotation={[0, 0, 0]} castShadow><cylinderGeometry args={[0.01, 7.6, 2.4, 3, 1]} /><meshStandardMaterial color={C.red} flatShading /></mesh>
      </>);
    case "skills": // stacked crates = toolbox
      return (<>
        {[[0, 0, 0, C.ink], [5, 0, 1, C.red], [-4.5, 0, -1, C.blue], [1, 1, 0, C.white], [-2, 1, -0.5, C.red], [0.5, 2, 0, C.blue]].map(([x, l, z, c], i) => (
          <Box key={i} p={[x as number, 2 + (l as number) * 4, z as number]} s={[4, 4, 4]} c={c as string} />
        ))}
      </>);
    case "contact": // radio mast
      return (<>
        <Box p={[0, 2, 0]} s={[6, 4, 6]} c={C.white} />
        <mesh position={[0, 12, 0]} castShadow><cylinderGeometry args={[0.2, 0.9, 16, 6]} /><meshStandardMaterial color={C.ink} /></mesh>
        <mesh position={[0, 20.5, 0]}><sphereGeometry args={[0.9, 16, 12]} /><meshStandardMaterial color={C.red} emissive={C.red} emissiveIntensity={0.6} /></mesh>
      </>);
  }
}

// Drawn into the 3D scene (not DOM overlay) so billboards and buildings hide it like any object.
const num = (cp: Checkpoint) => String(cp.index + 1).padStart(2, "0");

function drawLabel(c: HTMLCanvasElement, cp: Checkpoint) {
  const g = c.getContext("2d")!;
  const serif = cssFont("--font-serif", "Georgia");
  g.clearRect(0, 0, c.width, c.height);
  g.textBaseline = "middle";
  g.font = `italic 400 110px ${serif}`;
  const n = `${num(cp)} `, nw = g.measureText(n).width;
  g.font = `400 110px ${serif}`;
  const lw = g.measureText(cp.label).width, x = (c.width - nw - lw) / 2;
  g.lineWidth = 18; g.strokeStyle = C.paper; g.lineJoin = "round";
  g.font = `italic 400 110px ${serif}`; g.strokeText(n, x, c.height / 2); g.fillStyle = C.red; g.fillText(n, x, c.height / 2);
  g.font = `400 110px ${serif}`; g.strokeText(cp.label, x + nw, c.height / 2); g.fillStyle = C.ink; g.fillText(cp.label, x + nw, c.height / 2);
}

const PlotLabel = memo(function PlotLabel({ cp }: { cp: Checkpoint }) {
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 192;
    drawLabel(c, cp);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [cp]);
  useEffect(() => {
    if (!tex) return;
    document.fonts.ready.then(() => { drawLabel(tex.image as HTMLCanvasElement, cp); tex.needsUpdate = true; });
  }, [tex, cp]);
  return (
    <sprite position={[0, 23, 0]} scale={[21, 3.94, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} fog={false} />
    </sprite>
  );
});

function Landmark({ r, cp }: { r: Route; cp: Checkpoint }) {
  const status = useUI((u) => u.status[cp.id]);
  const approaching = useUI((u) => u.approaching === cp.id);
  const { gate, plot, yaw, face } = useMemo(() => {
    const gate = frameAt(r, cp.s), plot = frameAt(r, cp.s, cp.plotLat);
    // Building faces the road
    return { gate, plot, yaw: Math.atan2(gate.fwd.x, gate.fwd.z), face: Math.atan2(-cp.side * gate.right.x, -cp.side * gate.right.z) };
  }, [r, cp]);
  const gateColor = status === "visited" ? C.blue : C.red;
  const flag = useRef<THREE.Mesh>(null);
  useFrame((st) => { if (flag.current) flag.current.rotation.y = st.clock.elapsedTime * 1.5; });
  // Once a road is chosen, the other road's stops would only clutter the view where the two run side by side.
  const hidden = useUI((u) => u.route !== null && u.route !== r.id);
  if (hidden) return null;

  return (
    <group>
      {/* Gate over the road */}
      <group position={gate.pos} rotation={[0, yaw, 0]}>
        {[-1, 1].map((sd) => <Box key={sd} p={[sd * (ROAD_WIDTH / 2 + 0.8), 3, 0]} s={[0.6, 6, 0.6]} c={C.ink} />)}
        <Box p={[0, 6.2, 0]} s={[ROAD_WIDTH + 2.2, 1.1, 0.5]} c={gateColor} />
        {/* Stop line */}
        <mesh position={[0, 0.04, -2.5]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={LAYER.paint}><planeGeometry args={[ROAD_WIDTH - 1, 0.6]} /><meshBasicMaterial color={gateColor} {...FLAT} /></mesh>
      </group>

      {/* Plot + building */}
      <group position={plot.pos} rotation={[0, face, 0]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={LAYER.plot}><circleGeometry args={[13, 40]} /><meshStandardMaterial color={C.paper2} {...FLAT} /></mesh>
        <Building id={cp.id} />
        <mesh ref={flag} position={[0, 26, 0]}>
          <octahedronGeometry args={[1.2]} />
          <meshStandardMaterial color={status === "visited" ? C.blue : status === "skipped" ? C.mute : C.red} emissive={approaching ? C.red : "#000"} emissiveIntensity={approaching ? 0.8 : 0} />
        </mesh>
        <PlotLabel cp={cp} />
      </group>
    </group>
  );
}

/* ---------------- Billboards at the fork ---------------- */

type Board = { s: number; lat: number; arrow: string; title: string; body: string; foot: string; accent: string };
const BOARDS: Board[] = [
  { s: 26, lat: -12.5, arrow: "← Keep left", title: "Express", body: "The short version. Six stops, about two minutes, straight to the point.", foot: "Best if you're hiring", accent: C.blue },
  { s: 40, lat: 12.5, arrow: "Keep right →", title: "Scenic", body: "My life story, the long way round. Same stops, more road, more to see.", foot: "Best if you've got five minutes", accent: C.red },
];

function cssFont(v: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fallback;
}

/** Wraps `text` into lines that fit `w` at the current ctx font. */
function wrapText(g: CanvasRenderingContext2D, text: string, w: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > w && line) { out.push(line); line = word; } else line = next;
  }
  return [...out, line];
}

function drawBoard(c: HTMLCanvasElement, b: Board) {
  const g = c.getContext("2d")!;
  const serif = cssFont("--font-serif", "Georgia"), sans = cssFont("--font-sans", "system-ui"), mono = cssFont("--font-mono", "monospace");
  g.fillStyle = C.white; g.fillRect(0, 0, c.width, c.height);
  g.lineWidth = 12; g.strokeStyle = C.ink; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = b.accent; g.fillRect(6, 6, c.width - 12, 26);
  g.fillStyle = C.ink;
  g.font = `600 34px ${mono}`; g.fillText(b.arrow.toUpperCase(), 60, 100);
  g.font = `400 170px ${serif}`; g.fillText(b.title, 52, 250);
  g.fillStyle = C.mute; g.font = `500 40px ${sans}`;
  wrapText(g, b.body, c.width - 120).forEach((l, i) => g.fillText(l, 60, 325 + i * 52));
  g.fillStyle = b.accent; g.font = `italic 400 50px ${serif}`; g.fillText(b.foot, 60, c.height - 50);
}

function Billboard({ b }: { b: Board }) {
  const { pos, yaw } = useMemo(() => {
    const f = frameAt(routes.express, b.s, b.lat);
    // Face oncoming traffic, angled slightly towards the road
    return { pos: f.pos.clone(), yaw: Math.atan2(-f.fwd.x, -f.fwd.z) - Math.sign(b.lat) * 0.35 };
  }, [b]);
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 576;
    drawBoard(c, b);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [b]);
  // Redraw once the web fonts have loaded
  useEffect(() => {
    if (!tex) return;
    document.fonts.ready.then(() => { drawBoard(tex.image as HTMLCanvasElement, b); tex.needsUpdate = true; });
  }, [tex, b]);
  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      {/* Poster in front, backing 10 cm behind it, posts behind the backing: no coplanar faces to fight */}
      {[-5.5, 5.5].map((x) => <Box key={x} p={[x, 3, -0.65]} s={[0.4, 6, 0.4]} c={C.ink} />)}
      <mesh position={[0, 7.5, 0.05]} castShadow>
        <planeGeometry args={[16, 9]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Box p={[0, 7.5, -0.25]} s={[16.4, 9.4, 0.3]} c={C.ink} />
    </group>
  );
}

/* ---------------- Car + camera choreography ---------------- */

// Where the avatar waits, where he gets in, and the opening camera shot.
const STAND = frameAt(routes.express, 2.5, -7).pos.clone();
const DOOR = frameAt(routes.express, 0.4, -1.8).pos.clone();
const INTRO_CAM = frameAt(routes.express, 13, -11).pos.clone().setY(3.4);
const INTRO_LOOK = frameAt(routes.express, 1.5, -4.2).pos.clone().setY(1.9);
const AERIAL = new THREE.Vector3(-90, 70, -120);

function Car() {
  const car = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const light = useRef<THREE.DirectionalLight>(null);
  const f = useMemo(() => F0(), []);
  const camPos = useRef(AERIAL.clone());
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const want = useMemo(() => new THREE.Vector3(), []);
  const wantLook = useMemo(() => new THREE.Vector3(), []);
  const reduce = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useFrame(({ camera }, dt) => {
    step(dt);
    const route = currentRoute();
    frameAt(route, sim.s, sim.lat, f);
    const g = car.current!;
    g.position.copy(f.pos);
    g.rotation.y = Math.atan2(f.fwd.x, f.fwd.z) - sim.latV * 0.03 * Math.sign(sim.v || 1);
    const roll = THREE.MathUtils.clamp(turnAt(route, sim.s) * sim.v * 0.6, -0.12, 0.12);
    body.current!.rotation.z = THREE.MathUtils.damp(body.current!.rotation.z, roll, 6, dt);
    for (const w of wheels.current) if (w) w.rotation.x += (sim.v * dt) / 0.55;

    const { phase } = getUI();
    if (phase === "intro") {
      // Swoop in from above, then hold a two-shot of Haani and the car
      want.copy(INTRO_CAM); wantLook.copy(INTRO_LOOK);
    } else if (phase === "boarding" && sim.boardT < 1.1) {
      // Follow him to the door
      want.copy(INTRO_CAM).lerp(DOOR, 0.25).setY(3.2); wantLook.copy(DOOR).setY(1.6);
    } else {
      // Chase camera: behind and above, pulled further back with speed
      const back = 13 + Math.abs(sim.v) * 0.18;
      want.copy(f.pos).addScaledVector(f.fwd, -back).setY(6.5 + Math.abs(sim.v) * 0.05);
      wantLook.copy(f.pos).addScaledVector(f.fwd, 8).setY(1.5);
    }
    const k = phase === "driving" ? 3 : reduce ? 20 : 1.6;
    camPos.current.set(
      THREE.MathUtils.damp(camPos.current.x, want.x, k, dt),
      THREE.MathUtils.damp(camPos.current.y, want.y, k, dt),
      THREE.MathUtils.damp(camPos.current.z, want.z, k, dt),
    );
    look.current.set(
      THREE.MathUtils.damp(look.current.x, wantLook.x, k * 1.5, dt),
      THREE.MathUtils.damp(look.current.y, wantLook.y, k * 1.5, dt),
      THREE.MathUtils.damp(look.current.z, wantLook.z, k * 1.5, dt),
    );
    camera.position.copy(camPos.current);
    camera.lookAt(look.current);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = reduce || phase !== "driving" ? 50 : 52 + Math.abs(sim.v) * 0.35;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = THREE.MathUtils.damp(cam.fov, fov, 4, dt); cam.updateProjectionMatrix(); }

    // Keep the shadow camera centred on the car so a small shadow map stays sharp
    light.current!.position.set(f.pos.x + 30, 50, f.pos.z + 20);
    light.current!.target.position.copy(f.pos);
    light.current!.target.updateMatrixWorld();
  });

  const wheel = (x: number, z: number, i: number) => (
    <group key={i} position={[x, 0.55, z]} ref={(el) => { if (el) wheels.current[i] = el; }}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.55, 0.55, 0.45, 16]} /><meshStandardMaterial color={C.ink} /></mesh>
    </group>
  );

  return (
    <>
      <directionalLight ref={light} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-bias={-0.0005} />
      <group ref={car}>
        <group ref={body}>
          <Box p={[0, 1.05, 0]} s={[2.3, 0.8, 4.4]} c={C.red} />
          <Box p={[0, 1.75, -0.35]} s={[1.9, 0.7, 2.2]} c={C.white} />
          <Box p={[0, 1.78, 0.78]} s={[1.75, 0.55, 0.05]} c={C.ink} />
          <Box p={[0, 1.4, -2.2]} s={[2.4, 0.12, 0.5]} c={C.ink} />
          {[-0.75, 0.75].map((x) => (
            <mesh key={x} position={[x, 1.05, 2.21]}><boxGeometry args={[0.5, 0.25, 0.05]} /><meshStandardMaterial color="#fff6c8" emissive="#fff6c8" emissiveIntensity={1.4} /></mesh>
          ))}
          {[-0.8, 0.8].map((x) => (
            <mesh key={x} position={[x, 1.1, -2.21]}><boxGeometry args={[0.5, 0.2, 0.05]} /><meshStandardMaterial color={C.red} emissive={C.red} emissiveIntensity={0.9} /></mesh>
          ))}
        </group>
        {wheel(-1.15, 1.4, 0)}{wheel(1.15, 1.4, 1)}{wheel(-1.15, -1.4, 2)}{wheel(1.15, -1.4, 3)}
      </group>
    </>
  );
}

/* ---------------- Scene ---------------- */

export default function World() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, near: 0.5, far: 1100, position: AERIAL.toArray() }} gl={{ antialias: true }}>
      <color attach="background" args={[C.paper]} />
      <fog attach="fog" args={[C.paper, 90, 330]} />
      <hemisphereLight args={["#ffffff", C.paper2, 1.4]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow renderOrder={LAYER.ground}>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color={C.paper} {...FLAT} />
      </mesh>
      <Road r={routes.express} />
      <Road r={routes.scenic} />
      <Trees />
      {BOARDS.map((b) => <Billboard key={b.title} b={b} />)}
      {Object.values(routes).flatMap((r) => r.checkpoints.map((cp) => <Landmark key={`${r.id}-${cp.id}`} r={r} cp={cp} />))}
      <Avatar stand={STAND} door={DOOR} face={INTRO_CAM} />
      <Car />
    </Canvas>
  );
}
