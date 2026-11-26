import { lessonContent } from './lesson-builder';
import { labs, levels, runsOnLabels, type RunsOn } from './lessons';
import { labReady, readReport, type LabId, type SavedCheck } from './setup-check';

const brand = `${import.meta.env.BASE_URL}brand/`;
const repository = 'https://github.com/avizway1/learning-kubernetes-made-easy';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="#learn">
          <img src={`${brand}aviz-academy-logo-header.webp`} alt="Aviz Academy" width={134} height={44} />
          <span className="product-name">Learning Kubernetes made easy</span>
        </a>
        <nav className="site-nav" aria-label="Main">
          <a href="#learn" aria-current="page">Learn Kubernetes</a>
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

function Badge({ runsOn }: { runsOn: RunsOn }) {
  return <span className={`badge badge-${runsOn}`}>{runsOnLabels[runsOn]}</span>;
}

export function Learn({ check }: { check?: SavedCheck }) {
  const report = check ? readReport(check.report) : undefined;
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
                    : <span className="coming-soon">Coming soon</span>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section className="level" aria-labelledby="labs-title">
        <h2 id="labs-title">Hands-on labs</h2>
        <p>Do <strong>Set up your laptop</strong> once. Each lab starts with a lesson on its files, then you run it on your laptop.</p>
        <ol className="lesson-list">
          <li className="lesson setup-card">
            <div className="lesson-text">
              <h3>Set up your laptop</h3>
              <p className="lesson-objects">Do this once, before the labs</p>
              <p>Install the tools each lab needs, then run one check. Each lab unlocks when its tools are ready.</p>
              <p className="setup-status">
                {labs.map(lab => (
                  <span key={lab.id} className={labReady(report, lab.id as LabId) ? 'setup-chip setup-chip-ready' : 'setup-chip'}>
                    {labReady(report, lab.id as LabId) ? '✓ ' : ''}{lab.title.split(' · ')[0]} tools {labReady(report, lab.id as LabId) ? 'ready' : 'not ready'}
                  </span>
                ))}
              </p>
            </div>
            <div className="lesson-meta">
              <a className="lesson-start" href="#learn/setup">Set up<span className="visually-hidden"> your laptop</span></a>
            </div>
          </li>
          {labs.map(lab => (
            <li key={lab.id} className="lesson">
              <div className="lesson-text">
                <h3>{lab.title}</h3>
                <p className="lesson-objects">{lab.cost}</p>
                <p>{lab.summary}</p>
                {!labReady(report, lab.id as LabId) && (
                  <p className="lab-lock-note"><span aria-hidden="true">🔒 </span>The hands-on part unlocks when your {lab.title.split(' · ')[0]} tools are ready.</p>
                )}
              </div>
              <div className="lesson-meta">
                <Badge runsOn={lab.runsOn} />
                <a className="lab-link" href={`#learn/${lab.id}`}>Open lab<span className="visually-hidden"> {lab.title}</span></a>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
