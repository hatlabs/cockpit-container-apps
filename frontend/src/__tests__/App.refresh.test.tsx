/**
 * Tests for App's manual refresh error path.
 *
 * The Refresh button calls `actions.refreshPackages()`. If that rejects (e.g.
 * Cockpit returns access-denied or the backend is down), the App surfaces an
 * inline Alert that the user can dismiss. This path is otherwise silent in
 * happy-path tests because `loadPackages` swallows failures into state.
 *
 * We mock the AppContext so we can control `refreshPackages` directly,
 * keeping the test focused on the App-level error rendering — not on the
 * context's internal error routing.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the AppContext module before importing App so the App picks up the
// mocked useApp/AppProvider.
const refreshPackages = vi.fn();
const loadStores = vi.fn();
const loadCategories = vi.fn();
const loadPackages = vi.fn();

vi.mock('../context/AppContext', () => {
    const baseState = {
        stores: [],
        categories: [],
        packages: [],
        allPackages: [],
        activeStore: null,
        activeCategory: null,
        activeTab: 'available' as const,
        installFilter: 'all' as const,
        searchQuery: '',
        loading: false,
        error: null,
        packagesLoading: false,
        packagesError: null,
        updatingPackageLists: false,
        totalPackageCount: 0,
    };
    return {
        AppProvider: ({ children }: { children: React.ReactNode }) =>
            React.createElement(React.Fragment, null, children),
        useApp: () => ({
            state: baseState,
            actions: {
                loadStores,
                loadCategories,
                loadPackages,
                setActiveStore: vi.fn(),
                setActiveCategory: vi.fn(),
                setActiveTab: vi.fn(),
                setInstallFilter: vi.fn(),
                setSearchQuery: vi.fn(),
                clearError: vi.fn(),
                refreshPackages,
                refresh: vi.fn(),
            },
        }),
    };
});

// Mock the api module — the App imports formatErrorMessage from it.
vi.mock('../api', () => {
    class ContainerAppsError extends Error {
        code?: string;
        details?: string;
        constructor(message: string, code?: string, details?: string) {
            super(message);
            this.name = 'ContainerAppsError';
            this.code = code;
            this.details = details;
        }
    }
    return {
        formatErrorMessage: (e: unknown) => {
            if (e instanceof ContainerAppsError) {
                return e.details ? `${e.message}: ${e.details}` : e.message;
            }
            if (e instanceof Error) return e.message;
            return String(e);
        },
        ContainerAppsError,
    };
});

// Mock cockpit just enough for useUrlBasedNavigation + useAdminPermission.
beforeEach(() => {
    // @ts-expect-error - cockpit is a global
    globalThis.cockpit = {
        spawn: vi.fn(),
        file: vi.fn(),
        location: { path: [], options: {}, go: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };
    refreshPackages.mockReset();
    loadStores.mockReset();
    loadCategories.mockReset();
    loadPackages.mockReset();
});

afterEach(() => {
    // @ts-expect-error - cockpit is a global
    delete globalThis.cockpit;
});

describe('App refresh error path', () => {
    it('shows a dismissible Alert when refreshPackages rejects', async () => {
        const { App } = await import('../App');
        const { ContainerAppsError } = await import('../api');
        refreshPackages.mockRejectedValue(
            new ContainerAppsError('apt-get update failed', 'UPDATE_FAILED', 'connection refused')
        );

        render(<App />);

        const refreshButton = await screen.findByRole('button', {
            name: /refresh package data/i,
        });
        await userEvent.click(refreshButton);

        // Alert title + the formatted error message (message + details).
        expect(await screen.findByText(/refresh failed/i)).toBeInTheDocument();
        expect(screen.getByText(/apt-get update failed/i)).toBeInTheDocument();

        // Dismiss restores normal UI.
        const dismiss = screen.getByRole('button', { name: /dismiss refresh error/i });
        await userEvent.click(dismiss);
        await waitFor(() => expect(screen.queryByText(/refresh failed/i)).not.toBeInTheDocument());
    });
});
