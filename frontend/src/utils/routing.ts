/**
 * Routing utilities for browser navigation using Cockpit's location API
 *
 * Provides functions to synchronize RouterState with browser URL, enabling:
 * - Browser back/forward button navigation
 * - Deep linking (bookmarkable URLs)
 * - Page refresh state restoration
 */

import type { Package } from '../api/types';

// Re-export types from App.tsx for consistency
export type Route = 'store' | 'category' | 'app';

/**
 * Router state representing the current view
 */
export interface RouterState {
    route: Route;
    selectedPackage?: Package | null;
    selectedCategory?: string;
    appName?: string;  // Used when navigating to app via URL (package loaded separately)
    storeId?: string;  // Store from query params
    installFilter?: 'all' | 'available' | 'installed';  // Filter from query params
}

/**
 * Cockpit location format
 */
export interface RouterLocation {
    path: string[];
    options: Record<string, string | string[]>;
}

/**
 * Parse Cockpit location into RouterState
 *
 * URL patterns:
 * - / or [] → store view (categories)
 * - /category/:id → category app list
 * - /app/:name → app details
 *
 * Query params:
 * - ?store=<id> → active store
 * - ?filter=<all|available|installed> → install filter
 *
 * @param location - Cockpit location object
 * @returns RouterState representing the URL
 */
export function parseLocationToRouter(location: RouterLocation): RouterState {
    const { path, options } = location;

    // Helper to get first value from query param (can be string or string[])
    const getQueryParam = (key: string): string | undefined => {
        const value = options[key];
        if (Array.isArray(value)) {
            return value[0];
        }
        return value;
    };

    // Base state - default to store view
    const baseState: RouterState = {
        route: 'store',
    };

    // Parse path segments
    if (path.length === 0) {
        // Root path → store view
        return baseState;
    }

    const [segment1, segment2] = path;

    // /category/:id
    if (segment1 === 'category' && segment2) {
        return {
            route: 'category',
            selectedCategory: segment2,
        };
    }

    // /app/:name
    if (segment1 === 'app' && segment2) {
        return {
            route: 'app',
            selectedPackage: null,  // Package will be loaded separately
            appName: segment2,
        };
    }

    // Invalid path → fallback to store view
    return baseState;
}

/**
 * Build Cockpit location from RouterState
 *
 * @param router - Current router state
 * @param storeId - Optional store ID for query params
 * @param installFilter - Optional install filter for query params
 * @returns Cockpit location object
 */
export function buildLocationFromRouter(
    router: RouterState,
    storeId?: string,
    installFilter?: 'all' | 'available' | 'installed'
): RouterLocation {
    const options: Record<string, string> = {};

    // Add query params if provided
    if (storeId) {
        options.store = storeId;
    }
    if (installFilter && installFilter !== 'all') {
        options.filter = installFilter;
    }

    // Build path based on route
    switch (router.route) {
        case 'category':
            if (router.selectedCategory) {
                return {
                    path: ['category', router.selectedCategory],
                    options,
                };
            }
            // Fallback to store view if category is missing
            return { path: [], options };

        case 'app':
            if (router.selectedPackage) {
                return {
                    path: ['app', router.selectedPackage.name],
                    options,
                };
            }
            // Fallback to store view if package is missing
            return { path: [], options };

        case 'store':
        default:
            return { path: [], options };
    }
}

/**
 * Get initial router state from current URL on page load
 *
 * Parses the URL and extracts query parameters for complete state restoration.
 *
 * @param location - Cockpit location object
 * @returns RouterState with query params extracted
 */
export function getInitialRouterState(location: RouterLocation): RouterState {
    const baseState = parseLocationToRouter(location);

    // Extract query parameters
    const { options } = location;

    // Handle missing options
    if (!options) {
        return baseState;
    }

    // Helper to get first value from query param
    const getQueryParam = (key: string): string | undefined => {
        const value = options[key];
        if (Array.isArray(value)) {
            return value[0];
        }
        return value;
    };

    // Add store from query params
    const storeId = getQueryParam('store');
    if (storeId) {
        baseState.storeId = storeId;
    }

    // Add filter from query params (with validation)
    const filter = getQueryParam('filter');
    if (filter === 'all' || filter === 'available' || filter === 'installed') {
        baseState.installFilter = filter;
    }

    return baseState;
}
