"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Fades + lifts children in once they enter the viewport. Static when reduced motion is on. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

const line: Variants = { hidden: { y: "110%" }, show: (i: number) => ({ y: "0%", transition: { duration: 1, ease, delay: i * 0.08 } }) };

/** Section heading whose words rise from a mask, editorial-style. */
export function MaskedHeading({ text, em, as: Tag = "h2", className }: { text: string; em: string; as?: "h1" | "h2"; className?: string }) {
  const reduce = useReducedMotion();
  const words = [...text.trim().split(" ").map((w) => ({ w, em: false })), ...em.split(" ").map((w) => ({ w, em: true }))];
  const MotionTag = motion[Tag];
  return (
    <MotionTag className={className} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true }} aria-label={`${text}${em}`}>
      {words.map((x, i) => (
        <span key={i} aria-hidden="true" style={{ display: "inline-block", overflow: "clip", paddingBottom: "0.08em", verticalAlign: "top" }}>
          <motion.span style={{ display: "inline-block" }} variants={line} custom={i}>
            {x.em ? <em>{x.w}</em> : x.w}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </MotionTag>
  );
}

/** Cycles through words with a vertical roll. */
export function Rotator({ words }: { words: readonly string[] }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 2200);
    return () => clearInterval(id);
  }, [reduce, words.length]);
  return (
    <span style={{ display: "inline-grid", overflow: "clip", verticalAlign: "bottom" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.em
          key={words[i]}
          style={{ gridArea: "1/1", whiteSpace: "nowrap" }}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.6, ease }}
        >
          {words[i]}
        </motion.em>
      </AnimatePresence>
    </span>
  );
}

/** Portrait with scroll-linked parallax. Falls back to initials until public/photo.png exists. */
export function Portrait({ initials, alt, className }: { initials: string; alt: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();
  // The SSR'd <img> can fail before hydration attaches onError, so check once on mount too.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-40, 40]);
  const shadowX = useTransform(scrollYProgress, [0, 1], reduce ? [-16, -16] : [-6, -26]);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { clipPath: "inset(100% 0 0 0)" }}
      animate={{ clipPath: "inset(0% 0 0 0)" }}
      transition={{ duration: 1.3, ease, delay: 0.2 }}
    >
      <motion.span data-shadow style={{ x: shadowX }} />
      <motion.div data-frame style={{ y }}>
        {failed ? (
          <span data-initials>{initials}</span>
        ) : (
          // Plain <img>: photo.png is optional and next/image would log a 404 at build.
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img} src="/photo.png" alt={alt} onError={() => setFailed(true)} />
        )}
      </motion.div>
    </motion.div>
  );
}

/** Thin reading-progress bar along the top edge. */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  return <motion.div aria-hidden="true" className={className} style={{ scaleX: scrollYProgress, transformOrigin: "0 50%" }} />;
}
