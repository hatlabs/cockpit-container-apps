/**
 * useAdminPermission
 *
 * Reactive accessor for Cockpit's administrative-access state. Returns whether
 * the current Cockpit session is elevated (`allowed`) so admin-only UI actions
 * can be disabled with a clear tooltip when the user is in Limited Access mode.
 *
 * `allowed` is `null` until Cockpit has resolved the permission state.
 */

import { useEffect, useState } from 'react';

export interface AdminPermission {
    allowed: boolean | null;
}

export function useAdminPermission(): AdminPermission {
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        if (typeof cockpit === 'undefined' || !cockpit.permission) {
            // Test / non-Cockpit context — treat as elevated so UI is exercisable.
            setAllowed(true);
            return;
        }

        const permission = cockpit.permission({ admin: true });
        const update = () => setAllowed(permission.allowed);
        update();
        permission.addEventListener('changed', update);

        return () => {
            permission.removeEventListener('changed', update);
            permission.close();
        };
    }, []);

    return { allowed };
}
