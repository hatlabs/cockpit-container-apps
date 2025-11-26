/**
 * Custom hook for URL-based navigation
 *
 * Centralizes all URL initialization and browser back/forward handling logic.
 * Manages synchronization between URL state and application state.
 */

import { useEffect, useRef } from 'react';
import type { Package } from '../api/types';
import type { AppActions, AppState } from '../context/AppContext';
import { getCurrentLocation, onLocationChanged } from '../utils/cockpitHelpers';
import { getInitialRouterState, parseLocationToRouter, type RouterState } from '../utils/routing';

interface UseUrlBasedNavigationParams {
    state: AppState;
    actions: AppActions;
    setRouter: (router: RouterState | ((prev: RouterState) => RouterState)) => void;
}

/**
 * Hook to manage URL-based navigation initialization and browser back/forward
 *
 * @param state - Application state
 * @param actions - Application actions
 * @param setRouter - Router state setter
 */
export function useUrlBasedNavigation({ state, actions, setRouter }: UseUrlBasedNavigationParams): void {
    // Track whether we've initialized from URL
    const hasInitialized = useRef(false);

    // Helper to find package by name
    const findPackageByName = (packages: Package[], name: string): Package | undefined => {
        return packages.find((p) => p.name === name);
    };

    // Initialize from URL once when stores are loaded
    useEffect(() => {
        const location = getCurrentLocation();
        if (!location || hasInitialized.current || state.stores.length === 0) {
            return;
        }

        hasInitialized.current = true;

        // Apply initial URL state to app state
        const initialState = getInitialRouterState(location);

        // Set active store from URL if provided
        if (initialState.storeId) {
            const store = state.stores.find((s) => s.id === initialState.storeId);
            if (store) {
                actions.setActiveStore(store.id);
            }
        }

        // Set install filter from URL if provided
        if (initialState.installFilter) {
            actions.setInstallFilter(initialState.installFilter);
        }

        // Load data for initial route
        if (initialState.router.route === 'category') {
            actions.setActiveCategory(initialState.router.selectedCategory);
            // Packages will be loaded by AppContext when category changes
        }

        // For app route, trigger package loading if needed
        if (initialState.router.route === 'app') {
            if (state.packages.length === 0) {
                actions.loadPackages();
            }
        }
    }, [state.stores.length, state.stores, actions, state.packages.length]);

    // Update router state when packages are loaded and we're navigating to an app via URL
    useEffect(() => {
        const location = getCurrentLocation();
        if (!location) return;

        const currentRouter = parseLocationToRouter(location);
        if (currentRouter.route === 'app' && state.packages.length > 0) {
            const pkg = findPackageByName(state.packages, currentRouter.appName);
            if (pkg) {
                setRouter((prev) => {
                    // Only update if we don't already have the package
                    if (prev.route === 'app' && !prev.selectedPackage) {
                        return { ...prev, selectedPackage: pkg };
                    }
                    return prev;
                });
            }
        }
    }, [state.packages, setRouter]);

    // Listen for browser back/forward navigation
    useEffect(() => {
        const cleanup = onLocationChanged(() => {
            const location = getCurrentLocation();
            if (!location) return;

            const newState = parseLocationToRouter(location);

            // Update router state from URL
            if (newState.route === 'app') {
                // Trigger package loading if needed
                if (state.packages.length === 0) {
                    actions.loadPackages();
                }
                // Find package in state.packages
                const pkg = findPackageByName(state.packages, newState.appName);
                if (pkg) {
                    setRouter({ ...newState, selectedPackage: pkg });
                } else {
                    setRouter(newState);
                }
            } else if (newState.route === 'category') {
                actions.setActiveCategory(newState.selectedCategory);
                setRouter(newState);
            } else {
                setRouter(newState);
            }
        });

        return cleanup;
    }, [state.packages, actions, setRouter]);
}
