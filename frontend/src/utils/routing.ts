/**
 * Routing utilities for browser navigation using Cockpit's location API
 *
 * Provides functions to synchronize RouterState with browser URL, enabling:
 * - Browser back/forward button navigation
 * - Deep linking (bookmarkable URLs)
 * - Page refresh state restoration
 */

import type { Package } from '../api/types';

/**
 * Router state representing the current view
 * Uses discriminated union for type safety - TypeScript can narrow types based on route
 */
export type RouterState =
    | { route: 'store' }
    | { route: 'category'; selectedCategory: string }
    | {
        route: 'app';
        selectedPackage: Package | null;
        appName: string;
      };

/**
 * Router state with query parameters (store, filter)
 * Used for initialization from URL
 */
export interface RouterStateWithParams {
    router: RouterState;
    storeId?: string;
    installFilter?: 'all' | 'available' | 'installed';
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
    const { path } = location;

    // Parse path segments
    if (path.length === 0) {
        // Root path → store view
        return { route: 'store' };
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
    return { route: 'store' };
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
 * @returns RouterStateWithParams containing router state and query params
 */
export function getInitialRouterState(location: RouterLocation): RouterStateWithParams {
    const router = parseLocationToRouter(location);

    // Extract query parameters
    const { options } = location;

    // Handle missing options
    if (!options) {
        return { router };
    }

    // Helper to get first value from query param
    const getQueryParam = (key: string): string | undefined => {
        const value = options[key];
        if (Array.isArray(value)) {
            return value[0];
        }
        return value;
    };

    const result: RouterStateWithParams = { router };

    // Add store from query params
    const storeId = getQueryParam('store');
    if (storeId) {
        result.storeId = storeId;
    }

    // Add filter from query params (with validation)
    const filter = getQueryParam('filter');
    if (filter === 'all' || filter === 'available' || filter === 'installed') {
        result.installFilter = filter;
    }

    return result;
}
