/**
 * Application state management with React Context
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    ContainerAppsError,
    filterPackages,
    getStoreData,
    listCategories,
    listStores,
} from '../api';
import type { Category, FilterParams, Package, Store } from '../api/types';
import {
    loadActiveCategory,
    loadActiveStore,
    loadActiveTab,
    loadInstallFilter,
    loadSearchQuery,
    saveActiveCategory,
    saveActiveStore,
    saveActiveTab,
    saveInstallFilter,
    saveSearchQuery,
} from '../utils/storage';

/**
 * Application state interface
 */
export interface AppState {
    // Data
    stores: Store[];
    categories: Category[];
    packages: Package[]; // Filtered packages displayed in UI
    allPackages: Package[]; // Unfiltered cache of all packages for active store

    // Filters
    activeStore: string | null;
    activeCategory: string | null;
    activeTab: 'installed' | 'available'; // Deprecated - use installFilter
    installFilter: 'all' | 'available' | 'installed';
    searchQuery: string;

    // UI state
    loading: boolean;
    error: string | null;
    packagesLoading: boolean;
    packagesError: string | null;

    // Metadata
    totalPackageCount: number;
    limitedResults: boolean;
}

/**
 * Application actions interface
 */
export interface AppActions {
    // Data loading
    loadStores: () => Promise<void>;
    loadCategories: (storeId?: string) => Promise<void>;
    loadPackages: (params?: FilterParams) => Promise<void>;

    // Filter actions
    setActiveStore: (storeId: string | null) => void;
    setActiveCategory: (categoryId: string | null) => void;
    setActiveTab: (tab: 'installed' | 'available') => void; // Deprecated - use setInstallFilter
    setInstallFilter: (filter: 'all' | 'available' | 'installed') => void;
    setSearchQuery: (query: string) => void;

    // Utility actions
    clearError: () => void;
    refreshPackages: () => Promise<void>; // Refresh packages only (manual refresh)
    refresh: () => Promise<void>; // Full refresh (after install/uninstall)
}

/**
 * Combined context type
 */
export interface AppContextType {
    state: AppState;
    actions: AppActions;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Initial state
 */
const initialState: AppState = {
    stores: [],
    categories: [],
    packages: [],
    allPackages: [],
    activeStore: loadActiveStore(),
    activeCategory: loadActiveCategory(),
    activeTab: loadActiveTab() || 'available',
    installFilter: loadInstallFilter(),
    searchQuery: loadSearchQuery(),
    loading: true, // Start with loading state to show spinner on mount
    error: null,
    packagesLoading: false,
    packagesError: null,
    totalPackageCount: 0,
    limitedResults: false,
};

/**
 * AppContext Provider component
 */
export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const [state, setState] = useState<AppState>(initialState);
    const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadRequestId = useRef(0); // Track request IDs to handle race conditions

    // Load stores on mount
    const loadStores = useCallback(async () => {
        // Don't touch loading flag - let categories control it since that's the primary content
        setState((prev) => ({ ...prev, error: null }));
        try {
            const stores = await listStores();
            setState((prev) => {
                // If no store is selected and we have stores, default to the first one
                const activeStore = prev.activeStore || (stores.length > 0 ? stores[0].id : null);
                if (activeStore !== prev.activeStore && activeStore) {
                    saveActiveStore(activeStore);
                }
                return { ...prev, stores, activeStore };
            });
        } catch (e) {
            const error = e instanceof ContainerAppsError ? e.message : String(e);
            setState((prev) => ({ ...prev, error }));
        }
    }, []);

    // Load categories - now loads all count states at once
    const loadCategories = useCallback(
        async (storeId?: string) => {
            setState((prev) => {
                // Load categories without tab filter - backend returns all count states
                listCategories(storeId)
                    .then((categories) => {
                        setState((current) => ({ ...current, categories, loading: false }));
                    })
                    .catch((e) => {
                        const error = e instanceof ContainerAppsError ? e.message : String(e);
                        setState((current) => ({ ...current, error, loading: false }));
                    });

                return { ...prev, loading: true, error: null };
            });
        },
        []
    );

    // Helper function to filter packages client-side
    const filterPackagesClientSide = useCallback(
        (
            packages: Package[],
            installFilter: 'all' | 'available' | 'installed',
            searchQuery: string
        ): Package[] => {
            let filtered = packages;

            // Note: Category filtering is handled server-side when needed
            // because it requires debtags which aren't included in package objects

            // Filter by install status
            if (installFilter === 'available') {
                filtered = filtered.filter((pkg) => !pkg.installed);
            } else if (installFilter === 'installed') {
                filtered = filtered.filter((pkg) => pkg.installed);
            }
            // 'all' - no filtering

            // Filter by search query (case-insensitive match in name or summary)
            if (searchQuery && searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                filtered = filtered.filter(
                    (pkg) =>
                        pkg.name.toLowerCase().includes(query) ||
                        pkg.summary.toLowerCase().includes(query)
                );
            }

            return filtered;
        },
        []
    );

    // Load packages - with client-side filtering optimization
    //
    // Client-side filtering limitations:
    // - Only works when NO category is selected (viewing all store packages)
    // - Category filtering requires debtags from backend (not in Package objects)
    // - When category is selected, we fall back to backend filterPackages() call
    //
    // Performance: Client-side filtering provides <16ms response time vs 500ms backend calls
    const loadPackages = useCallback(
        async (params?: FilterParams) => {
            setState((prev) => {
                const storeId = params?.store_id ?? prev.activeStore;
                const categoryId = params?.category_id ?? prev.activeCategory;

                // If we have cached packages for this store and no category filter,
                // filter client-side for instant response
                if (prev.allPackages.length > 0 && storeId === prev.activeStore && !categoryId) {
                    const filtered = filterPackagesClientSide(
                        prev.allPackages,
                        prev.installFilter,
                        prev.searchQuery
                    );

                    return {
                        ...prev,
                        packages: filtered,
                        totalPackageCount: filtered.length,
                        packagesLoading: false,
                    };
                }

                // Otherwise, load from backend
                // When loading a store (no category), use consolidated endpoint
                if (storeId && !categoryId) {
                    // Increment request ID to handle race conditions when rapidly switching stores
                    const requestId = ++loadRequestId.current;

                    getStoreData(storeId)
                        .then((response) => {
                            // Ignore stale responses from old requests
                            if (requestId !== loadRequestId.current) {
                                return;
                            }

                            const allPackages = response.packages;
                            const filtered = filterPackagesClientSide(
                                allPackages,
                                prev.installFilter,
                                prev.searchQuery
                            );

                            setState((current) => ({
                                ...current,
                                allPackages,
                                categories: response.categories,
                                packages: filtered,
                                totalPackageCount: filtered.length,
                                limitedResults: false,
                                packagesLoading: false,
                            }));
                        })
                        .catch((e) => {
                            // Ignore errors from stale requests
                            if (requestId !== loadRequestId.current) {
                                return;
                            }

                            const error = e instanceof ContainerAppsError ? e.message : String(e);
                            setState((current) => ({
                                ...current,
                                packagesError: error,
                                packagesLoading: false,
                            }));
                        });
                } else {
                    // Category-specific load - use old filterPackages endpoint
                    // This is needed because category filtering requires debtags
                    // which aren't included in the package objects
                    let tabFilter: 'installed' | 'upgradable' | undefined;
                    if (prev.installFilter === 'installed') {
                        tabFilter = 'installed';
                    }

                    const filterParams: FilterParams = {
                        store_id: storeId ?? undefined,
                        category_id: categoryId ?? undefined,
                        tab: params?.tab ?? tabFilter,
                        search_query: prev.searchQuery || undefined,
                        limit: params?.limit ?? 1000,
                    };

                    filterPackages(filterParams)
                        .then((response) => {
                            const filtered = filterPackagesClientSide(
                                response.packages,
                                prev.installFilter,
                                prev.searchQuery
                            );

                            setState((current) => ({
                                ...current,
                                packages: filtered,
                                totalPackageCount: filtered.length,
                                limitedResults: response.limited,
                                packagesLoading: false,
                            }));
                        })
                        .catch((e) => {
                            const error = e instanceof ContainerAppsError ? e.message : String(e);
                            setState((current) => ({
                                ...current,
                                packagesError: error,
                                packagesLoading: false,
                            }));
                        });
                }

                return { ...prev, packagesLoading: true, packagesError: null };
            });
        },
        [filterPackagesClientSide]
    );

    // Set active store
    const setActiveStore = useCallback((storeId: string | null) => {
        setState((prev) => ({
            ...prev,
            activeStore: storeId,
            activeCategory: null,
            allPackages: [], // Clear cache when switching stores
        }));
        saveActiveStore(storeId);
        saveActiveCategory(null);
    }, []);

    // Set active category
    const setActiveCategory = useCallback((categoryId: string | null) => {
        setState((prev) => ({ ...prev, activeCategory: categoryId }));
        saveActiveCategory(categoryId);
    }, []);

    // Set active tab
    const setActiveTab = useCallback((tab: 'installed' | 'available') => {
        setState((prev) => ({ ...prev, activeTab: tab }));
        saveActiveTab(tab);
    }, []);

    // Set install filter with client-side filtering
    // When we have cached packages, filtering happens instantly client-side
    const setInstallFilter = useCallback(
        (filter: 'all' | 'available' | 'installed') => {
            setState((prev) => {
                // If we have cached packages, filter client-side immediately
                if (prev.allPackages.length > 0 && !prev.activeCategory) {
                    const filtered = filterPackagesClientSide(
                        prev.allPackages,
                        filter,
                        prev.searchQuery
                    );

                    saveInstallFilter(filter);
                    return {
                        ...prev,
                        installFilter: filter,
                        packages: filtered,
                        totalPackageCount: filtered.length,
                    };
                }

                // Otherwise, backend call will be triggered by useEffect
                saveInstallFilter(filter);
                return { ...prev, installFilter: filter };
            });
        },
        [filterPackagesClientSide]
    );

    // Set search query with client-side filtering
    // When we have cached packages, search filtering happens instantly client-side
    const setSearchQuery = useCallback(
        (query: string) => {
            // Clear existing debounce timer
            if (searchDebounceTimer.current) {
                clearTimeout(searchDebounceTimer.current);
            }

            // Update state immediately for UI responsiveness
            setState((prev) => {
                // If we have cached packages, filter client-side immediately
                if (prev.allPackages.length > 0 && !prev.activeCategory) {
                    const filtered = filterPackagesClientSide(
                        prev.allPackages,
                        prev.installFilter,
                        query
                    );

                    saveSearchQuery(query);
                    return {
                        ...prev,
                        searchQuery: query,
                        packages: filtered,
                        totalPackageCount: filtered.length,
                    };
                }

                // Otherwise, debounce the backend call (300ms)
                searchDebounceTimer.current = setTimeout(() => {
                    loadPackages();
                }, 300);

                saveSearchQuery(query);
                return { ...prev, searchQuery: query };
            });
        },
        [filterPackagesClientSide, loadPackages]
    );

    // Clear error
    const clearError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null, packagesError: null }));
    }, []);

    // Refresh packages only (for manual refresh button)
    const refreshPackages = useCallback(async () => {
        setState((prev) => ({ ...prev, allPackages: [] })); // Clear cache to force reload
        await loadPackages();
    }, [loadPackages]);

    // Refresh all data (called after install/uninstall)
    const refresh = useCallback(async () => {
        setState((prev) => ({ ...prev, allPackages: [] })); // Clear cache
        await loadStores();
        setState((prev) => {
            void loadCategories(prev.activeStore ?? undefined);
            return prev;
        });
        await loadPackages();
    }, [loadStores, loadCategories, loadPackages]);

    // Load initial data on mount
    useEffect(() => {
        void loadStores();
        void loadCategories(state.activeStore ?? undefined);
    }, [loadStores, loadCategories]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reload categories ONLY when active store changes (not filter - we have all counts cached)
    useEffect(() => {
        void loadCategories(state.activeStore ?? undefined);
    }, [state.activeStore, loadCategories]);

    // Reload packages when store or category changes
    // Note: installFilter and searchQuery changes are handled client-side for instant response
    useEffect(() => {
        void loadPackages();
    }, [
        loadPackages,
        state.activeStore,
        state.activeCategory,
        // searchQuery removed - handled by setSearchQuery with debouncing
        // installFilter removed - handled by setInstallFilter with client-side filtering
    ]);

    // Derive categories with correct counts based on current filter
    // This avoids reloading categories on filter changes
    const categoriesWithFilteredCounts = useMemo(() => {
        return state.categories.map((category) => {
            let count: number;
            if (state.installFilter === 'installed') {
                count = category.count_installed;
            } else if (state.installFilter === 'available') {
                count = category.count_available;
            } else {
                count = category.count_all;
            }
            return { ...category, count };
        });
    }, [state.categories, state.installFilter]);

    // Memoize actions to prevent unnecessary re-renders
    const actions: AppActions = useMemo(
        () => ({
            loadStores,
            loadCategories,
            loadPackages,
            setActiveStore,
            setActiveCategory,
            setActiveTab,
            setInstallFilter,
            setSearchQuery,
            clearError,
            refreshPackages,
            refresh,
        }),
        [
            loadStores,
            loadCategories,
            loadPackages,
            setActiveStore,
            setActiveCategory,
            setActiveTab,
            setInstallFilter,
            setSearchQuery,
            clearError,
            refreshPackages,
            refresh,
        ]
    );

    return (
        <AppContext.Provider
            value={{ state: { ...state, categories: categoriesWithFilteredCounts }, actions }}
        >
            {children}
        </AppContext.Provider>
    );
}

/**
 * Hook to use app context
 */
export function useApp(): AppContextType {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
}
