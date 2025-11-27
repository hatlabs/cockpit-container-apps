/**
 * Tests for BreadcrumbNav component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BreadcrumbNav } from '../BreadcrumbNav';

describe('BreadcrumbNav', () => {
    describe('at category level', () => {
        it('renders breadcrumb with Categories and category name', () => {
            render(
                <BreadcrumbNav
                    level="category"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            expect(screen.getByText('Categories')).toBeInTheDocument();
            expect(screen.getByText('Chart Plotters')).toBeInTheDocument();
        });

        it('makes Categories clickable', () => {
            render(
                <BreadcrumbNav
                    level="category"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            const categoriesButton = screen.getByRole('button', { name: /categories/i });
            expect(categoriesButton).toBeInTheDocument();
        });

        it('makes category name not clickable (active)', () => {
            render(
                <BreadcrumbNav
                    level="category"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            // Category name should not be a button
            const categoryButtons = screen.queryAllByRole('button', { name: /chart plotters/i });
            expect(categoryButtons).toHaveLength(0);
        });

        it('calls onNavigateToCategories when Categories is clicked', async () => {
            const handleNavigateToCategories = vi.fn();
            render(
                <BreadcrumbNav
                    level="category"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    onNavigateToCategories={handleNavigateToCategories}
                    onNavigateToCategory={vi.fn()}
                />
            );

            await userEvent.click(screen.getByRole('button', { name: /categories/i }));
            expect(handleNavigateToCategories).toHaveBeenCalled();
        });
    });

    describe('at app level', () => {
        it('renders breadcrumb with Categories, category name, and app name', () => {
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="avnav-container"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            expect(screen.getByText('Categories')).toBeInTheDocument();
            expect(screen.getByText('Chart Plotters')).toBeInTheDocument();
            expect(screen.getByText('avnav-container')).toBeInTheDocument();
        });

        it('makes Categories clickable', () => {
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="avnav-container"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            const categoriesButton = screen.getByRole('button', { name: /categories/i });
            expect(categoriesButton).toBeInTheDocument();
        });

        it('makes category name clickable', () => {
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="avnav-container"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            const categoryButton = screen.getByRole('button', { name: /chart plotters/i });
            expect(categoryButton).toBeInTheDocument();
        });

        it('makes app name not clickable (active)', () => {
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="avnav-container"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            // App name should not be a button
            const appButtons = screen.queryAllByRole('button', { name: /avnav-container/i });
            expect(appButtons).toHaveLength(0);
        });

        it('calls onNavigateToCategories when Categories is clicked', async () => {
            const handleNavigateToCategories = vi.fn();
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="avnav-container"
                    onNavigateToCategories={handleNavigateToCategories}
                    onNavigateToCategory={vi.fn()}
                />
            );

            await userEvent.click(screen.getByRole('button', { name: /categories/i }));
            expect(handleNavigateToCategories).toHaveBeenCalled();
        });

        it('calls onNavigateToCategory with categoryId when category name is clicked', async () => {
            const handleNavigateToCategory = vi.fn();
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="avnav-container"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={handleNavigateToCategory}
                />
            );

            await userEvent.click(screen.getByRole('button', { name: /chart plotters/i }));
            expect(handleNavigateToCategory).toHaveBeenCalledWith('navigation');
        });
    });

    describe('edge cases', () => {
        it('renders correctly with long category names', () => {
            render(
                <BreadcrumbNav
                    level="category"
                    categoryId="communication"
                    categoryLabel="Communication and Messaging Systems"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            expect(screen.getByText('Communication and Messaging Systems')).toBeInTheDocument();
        });

        it('renders correctly with long app names', () => {
            render(
                <BreadcrumbNav
                    level="app"
                    categoryId="navigation"
                    categoryLabel="Chart Plotters"
                    appName="very-long-application-name-container"
                    onNavigateToCategories={vi.fn()}
                    onNavigateToCategory={vi.fn()}
                />
            );

            expect(screen.getByText('very-long-application-name-container')).toBeInTheDocument();
        });
    });
});
