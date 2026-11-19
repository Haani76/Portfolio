"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BOARD_SECONDS, bubbleAnchor, getUI } from "./store";

/*
 * Low-poly Haani, built from boxes to match the world. Colours taken from his photo:
 * dark wavy hair, full beard, fair skin, olive field jacket over a beige check shirt.
 */
const K = { skin: "#f1d2bb", hair: "#1c1512", jacket: "#3d4733", jacketDark: "#2f3828", jeans: "#2b2e36", shoe: "#1b1a17", eye: "#141010" };

function plaid() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#cdbb9c"; g.fillRect(0, 0, 64, 64);
  g.globalAlpha = 0.55;
  g.fillStyle = "#8a7558";
  for (let i = 0; i < 64; i += 16) { g.fillRect(i, 0, 5, 64); g.fillRect(0, i, 64, 5); }
  g.globalAlpha = 0.35; g.fillStyle = "#f2ead9";
  for (let i = 8; i < 64; i += 16) { g.fillRect(i, 0, 2, 64); g.fillRect(0, i, 64, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type V3 = [number, number, number];
const B = ({ p, s, c, r, map }: { p: V3; s: V3; c?: string; r?: V3; map?: THREE.Texture }) => (
  <mesh position={p} rotation={r} castShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={map ? "#ffffff" : c} map={map} flatShading />
  </mesh>
);

/* ---------------- The character ---------------- */

/** `stand` = where he waits, `door` = where he gets in, `face` = point he looks at while talking. */
export function Avatar({ stand, door, face }: { stand: THREE.Vector3; door: THREE.Vector3; face: THREE.Vector3 }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const shirt = useMemo(() => (typeof document === "undefined" ? undefined : plaid()), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const boardStart = useRef<number | null>(null);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const { phase } = getUI();
    const g = root.current!;
    if (phase === "driving") { g.visible = false; return; }
    g.visible = true;

    if (phase === "intro") {
      g.position.copy(stand);
      g.scale.setScalar(1);
      g.rotation.y = Math.atan2(face.x - stand.x, face.z - stand.z);
      body.current!.position.y = Math.sin(t * 2) * 0.03; // breathing
      head.current!.rotation.z = Math.sin(t * 1.3) * 0.06;
      // Wave: right arm up, hand swinging
      armR.current!.rotation.z = THREE.MathUtils.damp(armR.current!.rotation.z, 2.7 + Math.sin(t * 7) * 0.35, 10, dt);
      armL.current!.rotation.z = THREE.MathUtils.damp(armL.current!.rotation.z, -0.08, 8, dt);
      legR.current!.rotation.x = legL.current!.rotation.x = 0;
      boardStart.current = null;
      // Where the speech bubble (a DOM element) should point: just above his head, in screen pixels.
      tmp.copy(stand).setY(3.55).project(st.camera);
      bubbleAnchor.x = ((tmp.x + 1) / 2) * st.size.width;
      bubbleAnchor.y = ((1 - tmp.y) / 2) * st.size.height;
      bubbleAnchor.on = tmp.z < 1;
      return;
    }

    // Boarding: arm down, walk to the door, then duck into the car.
    bubbleAnchor.on = false;
    boardStart.current ??= t;
    const bt = t - boardStart.current;
    const walk = Math.min(bt / (BOARD_SECONDS * 0.6), 1);
    tmp.lerpVectors(stand, door, walk * walk * (3 - 2 * walk));
    g.position.copy(tmp);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.atan2(door.x - stand.x, door.z - stand.z), 10, dt);
    const swing = walk < 1 ? Math.sin(bt * 12) * 0.5 : 0;
    legR.current!.rotation.x = swing;
    legL.current!.rotation.x = -swing;
    armR.current!.rotation.z = THREE.MathUtils.damp(armR.current!.rotation.z, 0.08, 12, dt);
    armR.current!.rotation.x = -swing * 0.6;
    armL.current!.rotation.x = swing * 0.6;
    body.current!.position.y = Math.abs(Math.sin(bt * 12)) * 0.06 * (1 - walk);
    // Duck in: sink and shrink into the driver's seat
    const inT = THREE.MathUtils.clamp((bt - BOARD_SECONDS * 0.6) / (BOARD_SECONDS * 0.25), 0, 1);
    g.scale.setScalar(1 - inT * 0.999);
    g.position.y -= inT * 0.6;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* Legs */}
        <group ref={legL} position={[-0.22, 1.05, 0]}>
          <B p={[0, -0.5, 0]} s={[0.34, 1.0, 0.38]} c={K.jeans} />
          <B p={[0, -1.0, 0.07]} s={[0.36, 0.14, 0.52]} c={K.shoe} />
        </group>
        <group ref={legR} position={[0.22, 1.05, 0]}>
          <B p={[0, -0.5, 0]} s={[0.34, 1.0, 0.38]} c={K.jeans} />
          <B p={[0, -1.0, 0.07]} s={[0.36, 0.14, 0.52]} c={K.shoe} />
        </group>

        {/* Torso: check shirt showing through an open olive jacket */}
        <B p={[0, 1.55, 0.02]} s={[0.5, 1.0, 0.5]} map={shirt} />
        <B p={[0, 1.55, -0.04]} s={[1.0, 1.05, 0.5]} c={K.jacket} />
        <B p={[-0.33, 1.55, 0.26]} s={[0.34, 1.05, 0.06]} c={K.jacket} />
        <B p={[0.33, 1.55, 0.26]} s={[0.34, 1.05, 0.06]} c={K.jacket} />
        <B p={[-0.33, 1.35, 0.305]} s={[0.22, 0.2, 0.03]} c={K.jacketDark} />
        <B p={[0.33, 1.35, 0.305]} s={[0.22, 0.2, 0.03]} c={K.jacketDark} />
        <B p={[0, 2.06, 0]} s={[0.78, 0.12, 0.52]} c={K.jacketDark} />
        <B p={[0, 2.12, 0.02]} s={[0.22, 0.14, 0.22]} c={K.skin} />

        {/* Arms pivot at the shoulder */}
        <group ref={armL} position={[-0.64, 1.98, 0]}>
          <B p={[0, -0.45, 0]} s={[0.27, 0.92, 0.32]} c={K.jacket} />
          <B p={[0, -0.98, 0]} s={[0.22, 0.2, 0.24]} c={K.skin} />
        </group>
        <group ref={armR} position={[0.64, 1.98, 0]}>
          <B p={[0, -0.45, 0]} s={[0.27, 0.92, 0.32]} c={K.jacket} />
          <B p={[0, -0.98, 0]} s={[0.22, 0.2, 0.24]} c={K.skin} />
        </group>

        {/* Head */}
        <group ref={head} position={[0, 2.5, 0]}>
          <B p={[0, 0, 0]} s={[0.6, 0.68, 0.58]} c={K.skin} />
          {/* full beard wrapping the jaw, and a moustache */}
          <B p={[0, -0.22, 0.04]} s={[0.64, 0.3, 0.56]} c={K.hair} />
          <B p={[0, -0.36, 0.12]} s={[0.4, 0.14, 0.4]} c={K.hair} />
          <B p={[0, -0.06, 0.3]} s={[0.3, 0.06, 0.03]} c={K.hair} />
          {/* nose, eyes, brows */}
          <B p={[0, 0.03, 0.31]} s={[0.09, 0.14, 0.08]} c={K.skin} />
          <B p={[-0.14, 0.12, 0.295]} s={[0.08, 0.06, 0.02]} c={K.eye} />
          <B p={[0.14, 0.12, 0.295]} s={[0.08, 0.06, 0.02]} c={K.eye} />
          <B p={[-0.14, 0.21, 0.295]} s={[0.15, 0.04, 0.02]} c={K.hair} r={[0, 0, 0.12]} />
          <B p={[0.14, 0.21, 0.295]} s={[0.15, 0.04, 0.02]} c={K.hair} r={[0, 0, -0.12]} />
          {/* ears */}
          <B p={[-0.31, 0.04, 0]} s={[0.05, 0.14, 0.1]} c={K.skin} />
          <B p={[0.31, 0.04, 0]} s={[0.05, 0.14, 0.1]} c={K.skin} />
          {/* wavy, voluminous hair swept up and back */}
          <B p={[0, 0.4, -0.04]} s={[0.66, 0.2, 0.64]} c={K.hair} />
          <B p={[-0.12, 0.52, 0.06]} s={[0.36, 0.16, 0.42]} c={K.hair} r={[0.25, 0, 0.2]} />
          <B p={[0.14, 0.5, 0.12]} s={[0.34, 0.14, 0.36]} c={K.hair} r={[0.35, 0, -0.25]} />
          <B p={[0.02, 0.36, 0.28]} s={[0.5, 0.1, 0.1]} c={K.hair} r={[-0.3, 0, 0.1]} />
          <B p={[0, 0.12, -0.3]} s={[0.64, 0.5, 0.08]} c={K.hair} />
          <B p={[-0.32, 0.22, -0.08]} s={[0.05, 0.3, 0.36]} c={K.hair} />
          <B p={[0.32, 0.22, -0.08]} s={[0.05, 0.3, 0.36]} c={K.hair} />
        </group>
      </group>
    </group>
  );
}

