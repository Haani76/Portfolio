"use client";

import { AnimatePresence, motion, useAnimationFrame } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { bubbleAnchor, useUI } from "./store";
import s from "./drive.module.css";

const LINE = "Hi, I'm Haani! You drive, I'll show you my life.";

/** A normal DOM element that follows the avatar's head (position written by the 3D scene each frame). */
export function SpeechBubble() {
  const intro = useUI((u) => u.phase === "intro");
  const [n, setN] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!intro) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setN(LINE.length), 600);
      return () => clearTimeout(id);
    }
    let i = 0, id = setTimeout(function tick() {
      setN(++i);
      if (i < LINE.length) id = setTimeout(tick, LINE[i - 1] === "," || LINE[i - 1] === "!" ? 260 : 38);
    }, 1400); // wait for the opening camera swoop
    return () => clearTimeout(id);
  }, [intro]);

  useAnimationFrame(() => {
    const el = anchor.current;
    if (!el) return;
    el.style.transform = `translate(${bubbleAnchor.x}px, ${bubbleAnchor.y}px)`;
    el.style.visibility = bubbleAnchor.on ? "visible" : "hidden";
  });

  return (
    <div ref={anchor} className={s.bubbleAnchor} aria-live="polite">
      <AnimatePresence>
        {intro && n > 0 && (
          <motion.div
            className={s.bubble}
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          >
            {/* Full line reserves the size so the bubble doesn't grow while typing */}
            <span className={s.bubbleGhost} aria-hidden="true">{LINE}</span>
            <span className={s.bubbleText}>{LINE.slice(0, n)}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
