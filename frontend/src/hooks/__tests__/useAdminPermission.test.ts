/**
 * Tests for useAdminPermission hook.
 *
 * Covers the four observable behaviors of the hook:
 *  - test/non-Cockpit fallback resolves `allowed: true`
 *  - Cockpit `permission({admin:true})` happy path mirrors `allowed`
 *  - `changed` events flip the returned state
 *  - cleanup removes the listener and closes the permission handle
 *
 * Plus a StrictMode-style remount check to make sure each mount obtains its
 * own permission handle and reacts independently — guards against the
 * "shared singleton listener" failure mode the review flagged.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useAdminPermission } from '../useAdminPermission';

type GlobalWithCockpit = typeof globalThis & { cockpit?: typeof cockpit };

interface FakePermission {
    allowed: boolean | null;
    addEventListener: Mock;
    removeEventListener: Mock;
    close: Mock;
    /** Helper to simulate Cockpit firing the `changed` event. */
    emitChanged: (next: boolean | null) => void;
}

const makeFakePermission = (initial: boolean | null): FakePermission => {
    const listeners = new Set<() => void>();
    const perm: FakePermission = {
        allowed: initial,
        addEventListener: vi.fn((event: string, cb: () => void) => {
            if (event === 'changed') listeners.add(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: () => void) => {
            if (event === 'changed') listeners.delete(cb);
        }),
        close: vi.fn(),
        emitChanged: (next: boolean | null) => {
            perm.allowed = next;
            for (const cb of listeners) cb();
        },
    };
    return perm;
};

describe('useAdminPermission', () => {
    let originalCockpit: typeof cockpit | undefined;

    beforeEach(() => {
        originalCockpit = (globalThis as GlobalWithCockpit).cockpit;
    });

    afterEach(() => {
        if (originalCockpit === undefined) {
            delete (globalThis as GlobalWithCockpit).cockpit;
        } else {
            (globalThis as GlobalWithCockpit).cockpit = originalCockpit;
        }
    });

    it('returns allowed=true when running outside Cockpit (no global cockpit)', () => {
        delete (globalThis as GlobalWithCockpit).cockpit;
        const { result } = renderHook(() => useAdminPermission());
        expect(result.current.allowed).toBe(true);
    });

    it('returns allowed=true when cockpit lacks permission()', () => {
        // Mimics the setup.ts default: a global cockpit without permission.
        (globalThis as GlobalWithCockpit).cockpit = {
            spawn: vi.fn(),
            file: vi.fn(),
            location: {} as CockpitLocation,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as typeof cockpit;
        const { result } = renderHook(() => useAdminPermission());
        expect(result.current.allowed).toBe(true);
    });

    it('mirrors the initial allowed value reported by cockpit.permission()', () => {
        const perm = makeFakePermission(false);
        const permissionFactory = vi.fn(() => perm);
        (globalThis as GlobalWithCockpit).cockpit = {
            spawn: vi.fn(),
            file: vi.fn(),
            location: {} as CockpitLocation,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            permission: permissionFactory,
        } as unknown as typeof cockpit;

        const { result } = renderHook(() => useAdminPermission());

        expect(permissionFactory).toHaveBeenCalledWith({ admin: true });
        expect(result.current.allowed).toBe(false);
    });

    it('re-renders with the new value when permission fires changed', () => {
        const perm = makeFakePermission(false);
        (globalThis as GlobalWithCockpit).cockpit = {
            spawn: vi.fn(),
            file: vi.fn(),
            location: {} as CockpitLocation,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            permission: vi.fn(() => perm),
        } as unknown as typeof cockpit;

        const { result } = renderHook(() => useAdminPermission());
        expect(result.current.allowed).toBe(false);

        act(() => {
            perm.emitChanged(true);
        });
        expect(result.current.allowed).toBe(true);

        act(() => {
            perm.emitChanged(null);
        });
        expect(result.current.allowed).toBeNull();
    });

    it('removes the listener and closes the permission on unmount', () => {
        const perm = makeFakePermission(true);
        (globalThis as GlobalWithCockpit).cockpit = {
            spawn: vi.fn(),
            file: vi.fn(),
            location: {} as CockpitLocation,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            permission: vi.fn(() => perm),
        } as unknown as typeof cockpit;

        const { unmount } = renderHook(() => useAdminPermission());
        expect(perm.addEventListener).toHaveBeenCalledWith('changed', expect.any(Function));

        unmount();

        expect(perm.removeEventListener).toHaveBeenCalledWith('changed', expect.any(Function));
        expect(perm.close).toHaveBeenCalledTimes(1);
    });

    it('second mount gets an independent handle and reacts on its own', () => {
        const permissions: FakePermission[] = [];
        const permissionFactory = vi.fn(() => {
            const p = makeFakePermission(false);
            permissions.push(p);
            return p;
        });
        (globalThis as GlobalWithCockpit).cockpit = {
            spawn: vi.fn(),
            file: vi.fn(),
            location: {} as CockpitLocation,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            permission: permissionFactory,
        } as unknown as typeof cockpit;

        const first = renderHook(() => useAdminPermission());
        expect(first.result.current.allowed).toBe(false);
        first.unmount();
        expect(permissions[0].close).toHaveBeenCalled();

        const second = renderHook(() => useAdminPermission());
        expect(second.result.current.allowed).toBe(false);
        expect(permissionFactory).toHaveBeenCalledTimes(2);
        // The new instance must be wired to permissions[1], not the stale one.
        act(() => {
            permissions[1].emitChanged(true);
        });
        expect(second.result.current.allowed).toBe(true);
        // The first hook is unmounted and should not be affected.
        expect(first.result.current.allowed).toBe(false);
    });
});
