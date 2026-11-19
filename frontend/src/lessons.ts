import catalog from '../../templates/kubernetes/lessons.json' with { type: 'json' };
export type RunsOn = 'anywhere' | 'eks' | 'k3s';

// Where a lesson runs, in learner words. K3s marks existing content that is tested only on K3s for now.
export const runsOnLabels: Record<RunsOn, string> = {
  anywhere: 'Anywhere',
  eks: 'EKS only',
  k3s: 'Tested on K3s',
};

export type Lesson = {
  id: string;
  title: string;
  objects: string;
  runsOn: RunsOn;
  summary: string;
};

export type Level = { id: string; title: string; summary: string; lessons: Lesson[] };

export type Lab = { id: string; title: string; runsOn: RunsOn; cost: string; summary: string; link?: string };

export const levels = catalog.levels as Level[];
export const labs = catalog.labs as Lab[];
