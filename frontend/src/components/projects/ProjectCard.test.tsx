import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProjectCard from './ProjectCard';
import StatusBadge from '../shared/StatusBadge';
import type { ProjectPreview } from '../../types';

const project: ProjectPreview = {
  id: 'trekpoint', title: 'TrekPoint', tagline: 'Maps', heroImage: '', category: 'iOS App',
  status: 'active', featured: true, createdAt: '2025-01-01T00:00:00Z',
};

describe('ProjectCard', () => {
  it('is a real link that the keyboard can reach', async () => {
    render(<MemoryRouter><ProjectCard project={project} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /TrekPoint/ });
    expect(link.getAttribute('href')).toBe('/projects/trekpoint');
    expect(link.textContent).toContain('(featured)');
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
  });
});

describe('StatusBadge', () => {
  it('shows an unknown status instead of crashing', () => {
    render(<StatusBadge status={'nonsense' as never} showLabel />);
    expect(screen.getByText('nonsense')).toBeTruthy();
  });

  it('gives the bare dot a text alternative', () => {
    render(<StatusBadge status="in-progress" />);
    expect(screen.getByText('In Progress:')).toBeTruthy();
  });
});
