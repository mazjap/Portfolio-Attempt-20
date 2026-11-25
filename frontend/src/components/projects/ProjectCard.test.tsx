import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('ProjectCard minimap', () => {
  const renderCard = (overrides: Partial<ProjectPreview>) =>
    render(<MemoryRouter><ProjectCard project={{ ...project, ...overrides }} /></MemoryRouter>);

  it('is the fallback for a code project with no hero image', () => {
    renderCard({ category: 'iOS App', heroImage: '' });
    expect(screen.getByTestId('card-minimap')).toBeTruthy();
  });

  it('is gone once the project has a hero image', () => {
    renderCard({ category: 'iOS App', heroImage: '/media/trekpoint/hero.webp' });
    expect(screen.queryByTestId('card-minimap')).toBeNull();
  });

  it('applies to web projects too', () => {
    const { rerender } = renderCard({ category: 'Web', heroImage: '' });
    expect(screen.getByTestId('card-minimap')).toBeTruthy();
    rerender(<MemoryRouter><ProjectCard project={{ ...project, category: 'Web', heroImage: '/media/site/hero.webp' }} /></MemoryRouter>);
    expect(screen.queryByTestId('card-minimap')).toBeNull();
  });

  it('is never shown for non-code categories', () => {
    const { rerender } = renderCard({ category: 'Hardware', heroImage: '' });
    expect(screen.queryByTestId('card-minimap')).toBeNull();
    rerender(<MemoryRouter><ProjectCard project={{ ...project, category: undefined, heroImage: '' }} /></MemoryRouter>);
    expect(screen.queryByTestId('card-minimap')).toBeNull();
  });

  // A hero image that fails to load (SwiftNES's live heroImage is a missing hero.jpg) counts as none.
  describe('when the hero image fails to load', () => {
    const img = () => document.querySelector('article img');

    it('falls back to the placeholder and minimap for an image with no srcset (one error)', () => {
      renderCard({ category: 'macOS App', heroImage: '/media/projects/nes-emulator/hero.jpg' });
      expect(img()).not.toBeNull();
      expect(screen.queryByTestId('card-minimap')).toBeNull();
      expect(screen.queryByTestId('card-ext-placeholder')).toBeNull();
      fireEvent.error(img()!);
      expect(img()).toBeNull();
      expect(screen.getByTestId('card-minimap')).toBeTruthy();
      expect(screen.getByTestId('card-ext-placeholder').textContent).toBe('.swift');
    });

    it('waits for the srcset fallback to fail too (two errors)', () => {
      renderCard({ category: 'iOS App', heroImage: '/media/projects/x/hero.webp' });
      expect(img()!.hasAttribute('srcset')).toBe(true);
      fireEvent.error(img()!); // a smaller size is missing: ResponsiveImage drops the srcset and retries src
      expect(img()).not.toBeNull();
      expect(img()!.hasAttribute('srcset')).toBe(false);
      expect(screen.queryByTestId('card-minimap')).toBeNull();
      fireEvent.error(img()!); // src fails as well
      expect(img()).toBeNull();
      expect(screen.getByTestId('card-minimap')).toBeTruthy();
      expect(screen.getByTestId('card-ext-placeholder').textContent).toBe('.swift');
    });

    it('tries again when the card gets a different hero image', () => {
      const { rerender } = renderCard({ category: 'macOS App', heroImage: '/media/projects/a/hero.jpg' });
      fireEvent.error(img()!);
      expect(img()).toBeNull();
      rerender(<MemoryRouter><ProjectCard project={{ ...project, category: 'macOS App', heroImage: '/media/projects/a/new.jpg' }} /></MemoryRouter>);
      expect(img()!.getAttribute('src')).toBe('/media/projects/a/new.jpg');
      expect(screen.queryByTestId('card-minimap')).toBeNull();
      expect(screen.queryByTestId('card-ext-placeholder')).toBeNull();
    });

    it('shows only the placeholder, no minimap, for a non-code project', () => {
      renderCard({ category: 'Hardware', heroImage: '/media/projects/a/hero.jpg' });
      fireEvent.error(img()!);
      expect(img()).toBeNull();
      expect(screen.queryByTestId('card-minimap')).toBeNull();
      expect(screen.getByTestId('card-ext-placeholder').textContent).toBe('.phys');
    });
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
