"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useSpring, useTransform, type Variants } from "motion/react";
import { useEffect, useRef } from "react";
import { profile, sections } from "@/data/portfolio";
import { SectionBody } from "@/components/SectionBody";
import { actions, currentRoute, getUI, keys, sim, useUI, ZONE, type Status } from "./store";
import { routes, SAMPLES, type RouteId } from "./track";
import { SpeechBubble } from "./SpeechBubble";
import s from "./drive.module.css";

// three.js needs the browser; keep it out of the server render and the first JS chunk.
const World = dynamic(() => import("./World"), { ssr: false, loading: () => <div className={s.loading}>Paving the road…</div> });

const ease = [0.22, 1, 0.36, 1] as const;
const KEYMAP: Record<string, keyof typeof keys> = {
  ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};

function useKeyboard() {
  useEffect(() => {
    const on = (down: boolean) => (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (k) {
        // Arrow keys on a focused link inside the panel should still drive, not scroll.
        e.preventDefault();
        keys[k] = down;
        if (down && getUI().phase === "intro") actions.board();
      }
      if (down && e.code === "Escape") {
        if (getUI().open) actions.close();
        else if (getUI().phase !== "driving") actions.skipIntro();
      }
    };
    const d = on(true), u = on(false);
    const reset = () => Object.keys(keys).forEach((k) => (keys[k as keyof typeof keys] = false));
    addEventListener("keydown", d);
    addEventListener("keyup", u);
    addEventListener("blur", reset);
    return () => { removeEventListener("keydown", d); removeEventListener("keyup", u); removeEventListener("blur", reset); };
  }, []);
}

/* ---------------- HUD pieces ---------------- */

function Speedo() {
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 220, damping: 30 });
  const kmh = useTransform(smooth, (v) => Math.round(Math.abs(v) * 4.2).toString().padStart(3, "0"));
  const sweep = useTransform(smooth, [0, 34], [0, 1], { clamp: true });
  useAnimationFrame(() => raw.set(sim.v));
  return (
    <div className={s.speedo} aria-hidden="true">
      <svg viewBox="0 0 100 60">
        <path d="M10 55 A40 40 0 0 1 90 55" className={s.arcBg} />
        <motion.path d="M10 55 A40 40 0 0 1 90 55" className={s.arc} style={{ pathLength: sweep }} />
      </svg>
      <motion.span className={s.kmh}>{kmh}</motion.span>
      <span className={s.unit}>km/h</span>
    </div>
  );
}

const W = 160, H = 160;
const bounds = (() => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const r of Object.values(routes)) for (const p of r.samples) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const k = Math.min((W - 20) / (x1 - x0), (H - 20) / (z1 - z0));
  return { map: (x: number, z: number) => [10 + (x - x0) * k, 10 + (z - z0) * k] as const };
})();
const paths = Object.fromEntries(Object.values(routes).map((r) => [r.id, r.samples.map((p, i) => `${i ? "L" : "M"}${bounds.map(p.x, p.z).join(" ")}`).join("") + "Z"])) as Record<RouteId, string>;

function MiniMap() {
  const dot = useRef<SVGCircleElement>(null);
  const status = useUI((u) => u.status);
  const chosen = useUI((u) => u.route);
  const r = routes[chosen ?? "express"];
  useAnimationFrame(() => {
    const cr = currentRoute();
    const i = Math.round(((((sim.s % cr.length) + cr.length) % cr.length) / cr.length) * SAMPLES) % (SAMPLES + 1);
    const [x, y] = bounds.map(cr.samples[i].x, cr.samples[i].z);
    dot.current?.setAttribute("cx", String(x));
    dot.current?.setAttribute("cy", String(y));
  });
  return (
    <svg className={s.map} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {(Object.keys(paths) as RouteId[]).map((id) => (
        <path key={id} d={paths[id]} className={s.mapRoad} data-dim={chosen && chosen !== id ? "" : undefined} />
      ))}
      {chosen && r.checkpoints.map((c) => {
        const p = r.samples[Math.round((c.s / r.length) * SAMPLES)];
        const [x, y] = bounds.map(p.x, p.z);
        return <circle key={c.id} cx={x} cy={y} r={4} className={s[`pin_${status[c.id]}`]} />;
      })}
      <circle ref={dot} r={5} className={s.car} />
    </svg>
  );
}

const listV: Variants = { show: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } } };
const itemV: Variants = { hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0, transition: { ease, duration: 0.5 } } };
const LABEL: Record<Status, string> = { pending: "ahead", visited: "visited", skipped: "skipped" };

function Stops() {
  const status = useUI((u) => u.status);
  const open = useUI((u) => u.open);
  return (
    <nav aria-label="Checkpoints" className={s.stopsWrap}>
      <motion.ol className={s.stops} variants={listV} initial="hidden" animate="show">
        {sections.map((x, i) => (
          <motion.li key={x.id} variants={itemV}>
            <button type="button" onClick={() => actions.travel(x.id)} aria-current={open === x.id ? "true" : undefined} data-status={status[x.id]}>
              <span className={s.stopNum}>{String(i + 1).padStart(2, "0")}</span>
              {x.label}
              <span className={s.stopState}>{LABEL[status[x.id]]}</span>
            </button>
          </motion.li>
        ))}
      </motion.ol>
    </nav>
  );
}

function Approach() {
  const id = useUI((u) => u.approaching);
  const sec = sections.find((x) => x.id === id);
  return (
    <AnimatePresence>
      {sec && (
        <motion.p
          key={sec.id}
          className={s.approach}
          role="status"
          initial={{ opacity: 0, y: -20, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          transition={{ ease, duration: 0.5 }}
        >
          <span>Next stop, {ZONE} m</span>
          <strong>{sec.label}</strong>
          <small>Ease off to stop · hold ↑ to drive past</small>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Section panel ---------------- */

function Panel() {
  const open = useUI((u) => u.open);
  const sec = sections.find((x) => x.id === open);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);
  const idx = sections.findIndex((x) => x.id === open);
  return (
    <AnimatePresence mode="wait">
      {sec && (
        <motion.aside
          key={sec.id}
          className={s.panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby="panel-h"
          initial={{ clipPath: "inset(0 0 0 100%)" }}
          animate={{ clipPath: "inset(0 0 0 0%)" }}
          exit={{ clipPath: "inset(0 100% 0 0)" }}
          transition={{ duration: 0.7, ease }}
        >
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7, ease }}>
            <p className="eyebrow"><span className={s.panelNum}>{String(idx + 1).padStart(2, "0")}</span> Checkpoint · {sec.label}</p>
            <h2 id="panel-h" ref={heading} tabIndex={-1} className={s.panelH}>{sec.title}<em>{sec.em}</em></h2>
            <SectionBody id={sec.id} compact />
          </motion.div>
          <div className={s.panelBar}>
            <button type="button" className="btn primary" onClick={actions.close}>Keep driving <kbd>↑</kbd></button>
            <span className={s.hint}>Esc to close</span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Touch controls ---------------- */

function Pedal({ k, label, children, className }: { k: keyof typeof keys; label: string; children: React.ReactNode; className?: string }) {
  const set = (v: boolean) => () => { keys[k] = v; if (v && getUI().phase === "intro") actions.board(); };
  return (
    <button type="button" aria-label={label} className={className}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(true)(); }}
      onPointerUp={set(false)} onPointerCancel={set(false)} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

/* ---------------- Intro: Haani talks in 3D; this card holds the controls ---------------- */

function Intro() {
  const intro = useUI((u) => u.phase === "intro");
  return (
    <AnimatePresence>
      {intro && (
        <motion.div
          className={s.intro}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: 40, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease }}
          variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 1.6 } } }}
        >
          <motion.p variants={itemV} className="eyebrow">Drive mode · {profile.name}</motion.p>
          <motion.h1 variants={itemV} className={s.introH}>Take the <em>scenic</em> route.</motion.h1>
          <motion.ul variants={itemV} className={s.keys} aria-label="Controls">
            <li><kbd>↑</kbd><kbd>W</kbd> gas</li>
            <li><kbd>↓</kbd><kbd>S</kbd> brake</li>
            <li><kbd>←</kbd><kbd>→</kbd> steer</li>
          </motion.ul>
          <motion.div variants={itemV} className={s.introCtas}>
            <button type="button" className="btn primary" onClick={actions.board} autoFocus>Get in the car</button>
            <button type="button" className="btn" onClick={actions.skipIntro}>Skip intro</button>
            <Link className={s.textLink} href="/">Just show me the CV →</Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Before the fork: tell the driver how to pick a road. */
function ForkHint() {
  const show = useUI((u) => u.phase === "driving" && u.route === null && u.open === null);
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          className={`${s.approach} ${s.forkHint}`}
          role="status"
          initial={{ opacity: 0, y: -20, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          transition={{ ease, duration: 0.5, delay: 0.6 }}
        >
          <span>The road splits ahead</span>
          <strong><span className={s.forkL}>← Express</span> · <span className={s.forkR}>Scenic →</span></strong>
          <small>Steer into the lane for the road you want</small>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Root ---------------- */

export default function DriveExperience() {
  useKeyboard();
  const driving = useUI((u) => u.phase === "driving");
  const lap = useUI((u) => u.lap);
  const route = useUI((u) => u.route);
  return (
    <div className={s.root}>
      <div className={s.canvas}><World /></div>
      <SpeechBubble />

      <header className={s.top}>
        <Link href="/" className={s.logo}>haani<em>.</em></Link>
        <span className={s.lap}>{route ? (route === "express" ? "Express" : "Scenic") + " · " : ""}Lap {lap}</span>
        <Link href="/" className="btn">Exit to standard</Link>
      </header>

      {driving && (
        <>
          <Stops />
          <ForkHint />
          <motion.div className={s.dash} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.8, ease }}>
            <MiniMap />
            <Speedo />
          </motion.div>
          <Approach />
          <div className={s.touch}>
            <div>
              <Pedal k="left" label="Steer left" className={s.pad}>←</Pedal>
              <Pedal k="right" label="Steer right" className={s.pad}>→</Pedal>
            </div>
            <div>
              <Pedal k="brake" label="Brake" className={s.pad}>Brake</Pedal>
              <Pedal k="gas" label="Gas" className={`${s.pad} ${s.gas}`}>Gas</Pedal>
            </div>
          </div>
        </>
      )}
      <Panel />
      <Intro />
    </div>
  );
}
