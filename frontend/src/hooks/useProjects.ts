import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useCache } from './useCache';
import type { ProjectPreview, ProjectNav } from '../types';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectPreview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useCache<ProjectPreview[]>('projects');

  useEffect(() => {
    const cached = cache.get();
    if (cached) {
      setProjects(cached);
      setLoading(false);
      return;
    }
    api.projects.list()
      .then(data => {
        setProjects(data);
        cache.set(data);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return { projects, loading, error };
}

export function useProjectNav() {
  const [nav, setNav] = useState<ProjectNav[] | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useCache<ProjectNav[]>('projects-nav');

  useEffect(() => {
    const cached = cache.get();
    if (cached) {
      setNav(cached);
      setLoading(false);
      return;
    }
    api.projects.nav()
      .then(data => {
        setNav(data);
        cache.set(data);
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoading(false));
  }, []);

  return { nav, loading };
}
