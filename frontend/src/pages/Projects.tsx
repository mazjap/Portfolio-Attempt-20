import { useProjects } from '../hooks/useProjects';
import ProjectGrid from '../components/projects/ProjectGrid';
import CrashReport from '../components/shared/CrashReport';

export default function Projects() {
  const { projects, loading, error } = useProjects();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-xcode-text-light dark:text-xcode-text mb-1">Projects</h1>
        <p className="text-xcode-muted text-sm">Things I've built, am building, or broke and rebuilt.</p>
      </div>

      {error ? (
        <CrashReport context="projects" />
      ) : (
        <ProjectGrid projects={projects ?? []} loading={loading} />
      )}
    </div>
  );
}
