/**
 * Tests for StoreSelector component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Store } from '../../api/types';
import { StoreSelector } from '../StoreSelector';

const mockStores: Store[] = [
    {
        id: 'halos-marine',
        name: 'HaLOS Marine',
        description: 'Marine applications for boat systems',
        icon: null,
        banner: null,
        filters: { sections: [], priorities: [] },
        category_metadata: null,
    },
    {
        id: 'halos-general',
        name: 'HaLOS General',
        description: 'General purpose applications',
        icon: null,
        banner: null,
        filters: { sections: [], priorities: [] },
        category_metadata: null,
    },
];

describe('StoreSelector', () => {
    it('renders with placeholder when no store selected', () => {
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId={null}
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByRole('button')).toHaveTextContent(/all stores/i);
    });

    it('renders selected store name', () => {
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId="halos-marine"
                onSelect={vi.fn()}
            />
        );
        expect(screen.getByRole('button')).toHaveTextContent('HaLOS Marine');
    });

    it('opens dropdown when clicked', async () => {
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId={null}
                onSelect={vi.fn()}
            />
        );

        await userEvent.click(screen.getByRole('button'));

        expect(screen.getByText('HaLOS Marine')).toBeInTheDocument();
        expect(screen.getByText('HaLOS General')).toBeInTheDocument();
    });

    it('shows "All Stores" option in dropdown', async () => {
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId="halos-marine"
                onSelect={vi.fn()}
            />
        );

        await userEvent.click(screen.getByRole('button'));

        expect(screen.getByText(/all stores/i)).toBeInTheDocument();
    });

    it('calls onSelect with store id when store selected', async () => {
        const handleSelect = vi.fn();
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId={null}
                onSelect={handleSelect}
            />
        );

        await userEvent.click(screen.getByRole('button'));
        await userEvent.click(screen.getByText('HaLOS General'));

        expect(handleSelect).toHaveBeenCalledWith('halos-general');
    });

    it('calls onSelect with null when "All Stores" selected', async () => {
        const handleSelect = vi.fn();
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId="halos-marine"
                onSelect={handleSelect}
            />
        );

        await userEvent.click(screen.getByRole('button'));
        // Find the "All Stores" option (not the toggle button)
        const allStoresOptions = screen.getAllByText(/all stores/i);
        await userEvent.click(allStoresOptions[allStoresOptions.length - 1]);

        expect(handleSelect).toHaveBeenCalledWith(null);
    });

    it('is disabled when loading', () => {
        render(
            <StoreSelector
                stores={mockStores}
                selectedStoreId={null}
                onSelect={vi.fn()}
                isLoading
            />
        );
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders empty state when no stores available', () => {
        render(
            <StoreSelector stores={[]} selectedStoreId={null} onSelect={vi.fn()} />
        );
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
