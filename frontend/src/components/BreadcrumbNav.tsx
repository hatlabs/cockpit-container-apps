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
    level: 'category' | 'app';

    /** Category ID for navigation */
    categoryId: string;

    /** Category display label */
    categoryLabel: string;

    /** App name (required for app level) */
    appName?: string;

    /** Navigate to categories view */
    onNavigateToCategories: () => void;

    /** Navigate to a specific category */
    onNavigateToCategory: (categoryId: string) => void;
}

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
    level,
    categoryId,
    categoryLabel,
    appName,
    onNavigateToCategories,
    onNavigateToCategory,
}) => {
    if (level === 'category') {
        // Category level: Categories > [Category Label]
        return (
            <Breadcrumb>
                <BreadcrumbItem component="button" onClick={onNavigateToCategories}>
                    Categories
                </BreadcrumbItem>
                <BreadcrumbItem isActive>{categoryLabel}</BreadcrumbItem>
            </Breadcrumb>
        );
    }

    // App level: Categories > [Category Label] > [App Name]
    return (
        <Breadcrumb>
            <BreadcrumbItem component="button" onClick={onNavigateToCategories}>
                Categories
            </BreadcrumbItem>
            <BreadcrumbItem component="button" onClick={() => onNavigateToCategory(categoryId)}>
                {categoryLabel}
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{appName}</BreadcrumbItem>
        </Breadcrumb>
    );
};
