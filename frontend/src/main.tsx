import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Learn, SiteFooter, SiteHeader } from './Site';
import { labs, levels } from './lessons';
import { defaultLessonValues, lessonContent } from './lesson-builder';
import { LessonView, type LessonProgress } from './LessonView';
import { labLessons } from './lab-lessons';
import { LabView, newLabProgress, type LabProgress } from './LabView';
import { loadCheck, saveCheck, type SavedCheck } from './setup-check';
import { SetupView } from './SetupView';
import './style.css';

const allLessons = levels.flatMap(level => level.lessons);

// #learn lists the lessons. #learn/pod opens a lesson, #learn/setup the setup page, and #learn/lab-1 a lab.
// An empty or unknown #learn address shows the lesson list. Any other hash is an anchor on the current page.
function routeFromHash(): { route: boolean; page?: string } {
  const hash = window.location.hash.slice(1);
  const [view, page] = hash.split('/');
  if (view !== 'learn') return { route: hash === '' };
  return { route: true, page: page && (lessonContent[page] || labLessons[page] || page === 'setup') ? page : undefined };
}

function App() {
  const [page, setPage] = useState(() => routeFromHash().page);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgress>>({});
  const [labProgress, setLabProgress] = useState<Record<string, LabProgress>>({});
  // The last setup check. Storage can be blocked, so the page keeps its own copy for the visit.
  const [check, setCheck] = useState<SavedCheck | undefined>(loadCheck);
  const onCheck = (next: SavedCheck) => {
    saveCheck(next);
    setCheck(next);
  };

  useEffect(() => {
    const onHashChange = () => {
      const next = routeFromHash();
      // Jump links such as #lesson-file scroll within the current page, so they keep it.
      if (!next.route) return;
      setPage(next.page);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const lab = page ? labLessons[page] : undefined;
  const content = page ? lessonContent[page] : undefined;
  const index = content ? allLessons.findIndex(lesson => lesson.id === page) : -1;
  const next = index >= 0 ? allLessons.slice(index + 1).find(lesson => lessonContent[lesson.id]) : undefined;

  return (
    <>
      <SiteHeader />
      <main>
        {!page && <Learn check={check} />}
        {page === 'setup' && <SetupView check={check} onCheck={onCheck} />}
        {page && lab && (
          <LabView key={page} lab={labs.find(entry => entry.id === page)!} content={lab} check={check}
            progress={labProgress[page] ?? newLabProgress()}
            onProgress={progress => setLabProgress(all => ({ ...all, [page]: progress }))} />
        )}
        {page && content && (
          <LessonView key={page} lesson={allLessons[index]} content={content} next={next} check={check}
            progress={lessonProgress[page] ?? { step: 0, values: defaultLessonValues(content), explanations: true }}
            onProgress={progress => setLessonProgress(all => ({ ...all, [page]: progress }))} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
