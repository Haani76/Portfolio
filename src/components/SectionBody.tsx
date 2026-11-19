import { education, jobs, profile, projects, skills, socials, stats, type SectionId } from "@/data/portfolio";
import s from "./sections.module.css";

/** Body of one portfolio section. Shared by the scrolling page and the drive-mode panels. */
export function SectionBody({ id, compact = false }: { id: SectionId; compact?: boolean }) {
  const c = compact ? s.compact : "";
  switch (id) {
    case "about":
      return (
        <div className={c}>
          <p className={s.lead}>{profile.summary}</p>
          <dl className={s.stats}>
            {stats.map((st) => (
              <div key={st.label}>
                <dt>{st.label}</dt>
                <dd>{st.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "work":
      return (
        <ol className={`${s.jobs} ${c}`}>
          {jobs.map((j) => (
            <li key={j.title} className={s.job}>
              <p className={s.when}>
                {j.when}
                {j.current && <span className={s.now}>Current</span>}
              </p>
              <div>
                <h3>{j.title}</h3>
                <p className={s.org}>{j.org}</p>
                <ul>{j.points.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
      );
    case "projects":
      return (
        <ul className={`${s.projects} ${c}`}>
          {projects.map((p, i) => {
            const inner = (
              <>
                <span className={s.idx}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{p.name}</h3>
                <p>{p.blurb}</p>
                <ul className={s.tags}>{p.tags.map((t) => <li key={t}>{t}</li>)}</ul>
                {p.href && <span className={s.go}>{p.cta ?? "View on GitHub"} →</span>}
              </>
            );
            return (
              <li key={p.name} className={p.feature && !compact ? s.feature : undefined}>
                {p.href ? <a className={s.proj} href={p.href} target="_blank" rel="noopener">{inner}</a> : <div className={s.proj}>{inner}</div>}
              </li>
            );
          })}
        </ul>
      );
    case "edu":
      return (
        <ul className={`${s.edu} ${c}`}>
          {education.map((e) => (
            <li key={e.title}>
              <span className={s.big} aria-hidden="true">{e.mark}</span>
              <p>{e.meta}</p>
              <h3>{e.title}</h3>
            </li>
          ))}
        </ul>
      );
    case "skills":
      return (
        <div className={`${s.bento} ${c}`}>
          {skills.map((g) => (
            <div key={g.group} className={g.wide && !compact ? s.wide : undefined}>
              <h3>{g.group}</h3>
              <ul className={s.pills}>{g.items.map((it) => <li key={it}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      );
    case "contact":
      return (
        <div className={c}>
          <p className={s.lead}>Open to remote support, implementation and cloud roles. Happy to relocate.</p>
          <ul className={s.socials}>
            {socials.map((l, i) => (
              <li key={l.label}>
                <a className={i === 0 ? "btn primary" : "btn"} href={l.href} rel="me">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}
