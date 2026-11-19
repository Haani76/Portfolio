import Link from "next/link";
import { profile, sections } from "@/data/portfolio";
import { SectionBody } from "@/components/SectionBody";
import { MaskedHeading, Portrait, Reveal, Rotator, ScrollProgress } from "@/components/editorial/Motion";
import s from "./page.module.css";

export default function Home() {
  return (
    <>
      <a className={s.skip} href="#main">Skip to content</a>
      <ScrollProgress className={s.progress} />

      <header className={s.top}>
        <Link className={s.logo} href="/">haani<em>.</em></Link>
        <nav aria-label="Sections" className={s.nav}>
          {sections.map((x) => <a key={x.id} href={`#${x.id}`}>{x.label}</a>)}
        </nav>
        <Link className="btn primary" href="/drive">Drive mode <span aria-hidden="true">→</span></Link>
      </header>

      <main id="main">
        <section className={s.hero}>
          <div className={s.heroText}>
            <p className="eyebrow">Portfolio · {profile.location}</p>
            <MaskedHeading as="h1" className={s.h1} text={profile.first} em={` ${profile.last}`} />
            <Reveal delay={0.4}>
              <p className={s.role}>
                {profile.role}. I make <Rotator words={profile.rotating} /> behave.
              </p>
              <div className={s.ctas}>
                <a className="btn primary" href="#work">Read the CV</a>
                <Link className="btn" href="/drive">Or take the scenic route <span aria-hidden="true">🚗</span></Link>
              </div>
            </Reveal>
          </div>
          <Portrait className={s.portrait} initials="HS" alt={`Portrait of ${profile.name}`} />
        </section>

        {sections.map((x, i) => (
          <section key={x.id} id={x.id} className={s.section} aria-labelledby={`${x.id}-h`}>
            <div className={s.head}>
              <span className={s.num} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <p className="eyebrow">{x.label}</p>
            </div>
            <div id={`${x.id}-h`}>
              <MaskedHeading className={s.h2} text={x.title} em={x.em} />
            </div>
            <Reveal>
              <SectionBody id={x.id} />
            </Reveal>
          </section>
        ))}
      </main>

      <footer className={s.footer}>
        <p>© {profile.name}</p>
        <Link href="/drive">Prefer to drive? →</Link>
      </footer>
    </>
  );
}
