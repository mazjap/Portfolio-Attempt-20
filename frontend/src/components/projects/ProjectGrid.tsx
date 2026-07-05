import ProjectCard from './ProjectCard';
import type { ProjectPreview } from '../../types';

interface Props {
  projects: ProjectPreview[];
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-xcode-border-light dark:border-xcode-border overflow-hidden animate-pulse">
      <div className="h-40 bg-xcode-surface-light dark:bg-xcode-surface" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
        <div className="h-3 w-full rounded bg-xcode-surface-light dark:bg-xcode-surface" />
        <div className="h-3 w-4/5 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
      </div>
    </div>
  );
}

export default function ProjectGrid({ projects, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4].map(n => <SkeletonCard key={n} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(p => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
