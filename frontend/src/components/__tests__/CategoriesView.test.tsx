/**
 * Tests for CategoriesView component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '../../api/types';
import { CategoriesView } from '../CategoriesView';

const mockCategories: Category[] = [
    {
        id: 'navigation',
        label: 'Navigation',
        icon: null,
        description: 'Navigation and GPS applications',
        count: 5,
    },
    {
        id: 'monitoring',
        label: 'Monitoring',
        icon: null,
        description: 'System monitoring tools',
        count: 3,
    },
    {
        id: 'communication',
        label: 'Communication',
        icon: null,
        description: 'Communication applications',
        count: 2,
    },
];

describe('CategoriesView', () => {
    it('renders loading state', () => {
        render(
            <CategoriesView
                categories={[]}
                isLoading
                error={null}
                onNavigate={vi.fn()}
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders error state with retry button', async () => {
        const handleRetry = vi.fn();
        render(
            <CategoriesView
                categories={[]}
                isLoading={false}
                error="Failed to load categories"
                onNavigate={vi.fn()}
                onRetry={handleRetry}
            />
        );

        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /retry/i }));
        expect(handleRetry).toHaveBeenCalled();
    });

    it('renders empty state when no categories', () => {
        render(
            <CategoriesView
                categories={[]}
                isLoading={false}
                error={null}
                onNavigate={vi.fn()}
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByText(/no categories/i)).toBeInTheDocument();
    });

    it('renders category cards in a grid', () => {
        render(
            <CategoriesView
                categories={mockCategories}
                isLoading={false}
                error={null}
                onNavigate={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('Navigation')).toBeInTheDocument();
        expect(screen.getByText('Monitoring')).toBeInTheDocument();
        expect(screen.getByText('Communication')).toBeInTheDocument();
    });

    it('navigates to category when card clicked', async () => {
        const handleNavigate = vi.fn();
        render(
            <CategoriesView
                categories={mockCategories}
                isLoading={false}
                error={null}
                onNavigate={handleNavigate}
                onRetry={vi.fn()}
            />
        );

        // Find the Navigation category card and click it
        const cards = screen.getAllByRole('button');
        const navCard = cards.find((card) => card.textContent?.includes('Navigation'));
        expect(navCard).toBeDefined();
        await userEvent.click(navCard!);

        expect(handleNavigate).toHaveBeenCalledWith('navigation');
    });

    it('shows category count in badge', () => {
        render(
            <CategoriesView
                categories={mockCategories}
                isLoading={false}
                error={null}
                onNavigate={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText('5 apps')).toBeInTheDocument();
        expect(screen.getByText('3 apps')).toBeInTheDocument();
        expect(screen.getByText('2 apps')).toBeInTheDocument();
    });

    it('renders title when provided', () => {
        render(
            <CategoriesView
                categories={mockCategories}
                isLoading={false}
                error={null}
                onNavigate={vi.fn()}
                onRetry={vi.fn()}
                title="Browse Categories"
            />
        );

        expect(screen.getByText('Browse Categories')).toBeInTheDocument();
    });
});
