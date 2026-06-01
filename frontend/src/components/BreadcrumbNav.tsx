/**
 * BreadcrumbNav Component
 *
 * Provides hierarchical navigation breadcrumbs for the app.
 * Shows the current location and allows navigation back up the hierarchy.
 */

import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import React from 'react';

export interface BreadcrumbNavProps {
    /** Current navigation level */
    level: 'categories' | 'category' | 'app';

    /** Category ID for navigation (not required for categories level) */
    categoryId?: string;

    /** Category display label (not required for categories level) */
    categoryLabel?: string;

    /** App name (required for app level) */
    appName?: string;

    /** Navigate to categories view */
    onNavigateToCategories?: () => void;

    /** Navigate to a specific category */
    onNavigateToCategory?: (categoryId: string) => void;
}

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
    level,
    categoryId,
    categoryLabel,
    appName,
    onNavigateToCategories,
    onNavigateToCategory,
}) => {
    if (level === 'categories') {
        // Categories level: Just "Categories" (non-clickable)
        return (
            <Breadcrumb className="pf-v6-u-pb-lg">
                <BreadcrumbItem isActive>Categories</BreadcrumbItem>
            </Breadcrumb>
        );
    }

    if (level === 'category') {
        // Category level: Categories > [Category Label]
        return (
            <Breadcrumb className="pf-v6-u-pb-lg">
                <BreadcrumbItem component="button" onClick={onNavigateToCategories}>
                    Categories
                </BreadcrumbItem>
                <BreadcrumbItem isActive>{categoryLabel}</BreadcrumbItem>
            </Breadcrumb>
        );
    }

    // App level: Categories > [Category Label] > [App Name]
    return (
        <Breadcrumb className="pf-v6-u-pb-lg">
            <BreadcrumbItem component="button" onClick={onNavigateToCategories}>
                Categories
            </BreadcrumbItem>
            <BreadcrumbItem component="button" onClick={() => onNavigateToCategory?.(categoryId!)}>
                {categoryLabel}
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{appName}</BreadcrumbItem>
        </Breadcrumb>
    );
};
