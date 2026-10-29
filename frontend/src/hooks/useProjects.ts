import { api } from '../lib/api';
import { isListOfItems } from '../lib/cache';
import { useCachedList } from './useCachedList';
import type { ProjectPreview, ProjectNav } from '../types';

const loadProjects = () => api.projects.list();
const loadProjectNav = () => api.projects.nav();

export function useProjects() {
  const { data, loading, error, retry } = useCachedList('projects', loadProjects, isListOfItems<ProjectPreview>);
  return { projects: data, loading, error, retry };
}

export function useProjectNav({ enabled = true }: { enabled?: boolean } = {}) {
  const { data, loading } = useCachedList('projects-nav', loadProjectNav, isListOfItems<ProjectNav>, { enabled });
  return { nav: data, loading };
}
