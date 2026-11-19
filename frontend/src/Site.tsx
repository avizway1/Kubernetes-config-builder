import { lessonContent } from './lesson-builder';
import { labs, levels, runsOnLabels, type OpenTarget, type RunsOn } from './lessons';

export type View = 'home' | 'learn' | 'build';

const brand = `${import.meta.env.BASE_URL}brand/`;
const repository = 'https://github.com/cavula/Kubernetes-config-builder';

export function SiteHeader({ view }: { view: View }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="#home">
          <img src={`${brand}aviz-academy-logo-header.webp`} alt="Aviz Academy" width={134} height={44} />
          <span className="product-name">Kubernetes Made Simple</span>
        </a>
        <nav className="site-nav" aria-label="Main">
          <a href="#learn" aria-current={view === 'learn' ? 'page' : undefined}>Learn Kubernetes</a>
          <a href="#build" aria-current={view === 'build' ? 'page' : undefined}>Build a config</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Built by <a href="https://avizacademy.com" target="_blank" rel="noopener">Aviz Academy</a></p>
      <p>
        <a href={`${repository}/blob/main/LICENSE`} target="_blank" rel="noopener">MIT License</a>
        {' · '}
        <a href={repository} target="_blank" rel="noopener">Source code</a>
      </p>
    </footer>
  );
}

export function Home() {
  return (
    <section className="home" aria-labelledby="home-title">
      <h1 id="home-title">What would you like to do?</h1>
      <p className="lead">Kubernetes, one simple block at a time. Written for Amazon EKS, with free practice on your laptop.</p>
      <div className="doors">
        <a className="door door-primary" href="#learn">
          <h2>Learn Kubernetes</h2>
          <p>New to Kubernetes? Build real files one block at a time, with plain-English help for every line.</p>
          <span className="door-action">Start learning</span>
        </a>
        <a className="door" href="#build">
          <h2>Build a config</h2>
          <p>Know what you need? Fill in a short form and copy ready-to-use YAML for Argo CD or Prometheus.</p>
          <span className="door-action">Open the builder</span>
        </a>
      </div>
    </section>
  );
}

function Badge({ runsOn }: { runsOn: RunsOn }) {
  return <span className={`badge badge-${runsOn}`}>{runsOnLabels[runsOn]}</span>;
}

export function Learn({ onOpen }: { onOpen: (target: OpenTarget) => void }) {
  return (
    <section className="learn" aria-labelledby="learn-title">
      <h1 id="learn-title">Learn Kubernetes</h1>
      <p className="lead">
        Lessons are written for Amazon EKS with Auto Mode. <strong>Anywhere</strong> lessons also run free on a
        practice cluster on your laptop. <strong>EKS only</strong> lessons use AWS features.
      </p>
      {levels.map(level => (
        <section key={level.id} className="level" aria-labelledby={`${level.id}-title`}>
          <h2 id={`${level.id}-title`}>{level.title}</h2>
          <p>{level.summary}</p>
          <ol className="lesson-list">
            {level.lessons.map(lesson => (
              <li key={lesson.id} className="lesson">
                <div className="lesson-text">
                  <h3>{lesson.title}</h3>
                  <p className="lesson-objects">{lesson.objects}</p>
                  <p>{lesson.summary}</p>
                </div>
                <div className="lesson-meta">
                  <Badge runsOn={lesson.runsOn} />
                  {lessonContent[lesson.id]
                    ? <a className="lesson-start" href={`#learn/${lesson.id}`}>Start<span className="visually-hidden"> {lesson.title}</span></a>
                    : lesson.open
                    ? <button type="button" onClick={() => onOpen(lesson.open!)}>Open<span className="visually-hidden"> {lesson.title}</span></button>
                    : <span className="coming-soon">Coming soon</span>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section className="level" aria-labelledby="labs-title">
        <h2 id="labs-title">Hands-on labs</h2>
        <ol className="lesson-list">
          {labs.map(lab => (
            <li key={lab.id} className="lesson">
              <div className="lesson-text">
                <h3>{lab.title}</h3>
                <p className="lesson-objects">{lab.cost}</p>
                <p>{lab.summary}</p>
              </div>
              <div className="lesson-meta">
                <Badge runsOn={lab.runsOn} />
                {lab.link
                  ? <a className="lab-link" href={lab.link} target="_blank" rel="noopener">Open guide<span className="visually-hidden"> for {lab.title}</span></a>
                  : <span className="coming-soon">Coming soon</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
