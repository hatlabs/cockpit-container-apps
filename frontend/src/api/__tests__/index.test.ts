/**
 * Tests for API wrapper layer
 *
 * Tests the frontend API wrapper that calls cockpit-container-apps CLI.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ContainerAppsError,
    __internal__,
    filterPackages,
    formatErrorMessage,
    installPackage,
    listCategories,
    listPackagesByCategory,
    listStores,
} from '../index';

const { extractJsonObjects, findErrorInRawOutput } = __internal__;

// Mock the global cockpit object
const mockSpawn = vi.fn();
(globalThis as typeof globalThis & { cockpit: typeof cockpit }).cockpit = {
    spawn: mockSpawn,
    file: vi.fn(),
    location: {} as Location,
} as typeof cockpit;

describe('API Wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listStores', () => {
        it('should parse valid JSON response', async () => {
            const mockStores = [
                {
                    id: 'marine',
                    name: 'Marine Apps',
                    description: 'Marine applications',
                    icon: null,
                    banner: null,
                    filters: {
                        include_origins: ['marine'],
                        include_sections: [],
                        include_tags: [],
                        include_packages: [],
                    },
                    category_metadata: null,
                },
            ];

            let streamCallback: ((data: string) => void) | null = null;
            let doneCallback: ((data: string | null) => void) | null = null;

            const mockProc = {
                stream: vi.fn((cb: (data: string) => void) => {
                    streamCallback = cb;
                    return mockProc;
                }),
                done: vi.fn((cb: (data: string | null) => void) => {
                    doneCallback = cb;
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            const promise = listStores();

            // Simulate stdout data
            if (streamCallback) streamCallback(JSON.stringify(mockStores));
            if (doneCallback) doneCallback(null);

            const result = await promise;
            expect(result).toEqual(mockStores);
            expect(mockSpawn).toHaveBeenCalledWith(
                ['cockpit-container-apps', 'list-stores'],
                expect.any(Object)
            );
        });

        it('should handle backend errors', async () => {
            const mockError = {
                error: 'Failed to load stores',
                code: 'CONFIG_ERROR',
            };

            const mockProc = {
                stream: vi.fn().mockReturnThis(),
                done: vi.fn().mockReturnThis(),
                fail: vi.fn((callback) => {
                    callback(JSON.stringify(mockError), null);
                    return mockProc;
                }),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            await expect(listStores()).rejects.toThrow(ContainerAppsError);
            await expect(listStores()).rejects.toThrow('Failed to load stores');
        });
    });

    describe('listCategories', () => {
        it('should call without store filter', async () => {
            const mockCategories = [
                { id: 'navigation', label: 'Navigation', icon: null, description: null, count: 5 },
                { id: 'monitoring', label: 'Monitoring', icon: null, description: null, count: 3 },
            ];

            const mockProc = {
                stream: vi.fn((callback) => {
                    callback(JSON.stringify(mockCategories));
                    return mockProc;
                }),
                done: vi.fn((callback) => {
                    callback();
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            const result = await listCategories();
            expect(result).toEqual(mockCategories);
            expect(mockSpawn).toHaveBeenCalledWith(
                ['cockpit-container-apps', 'list-categories'],
                expect.any(Object)
            );
        });

        it('should call with store filter', async () => {
            const mockCategories = [
                { id: 'navigation', label: 'Navigation', icon: null, description: null, count: 5 },
            ];

            const mockProc = {
                stream: vi.fn((callback) => {
                    callback(JSON.stringify(mockCategories));
                    return mockProc;
                }),
                done: vi.fn((callback) => {
                    callback();
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            const result = await listCategories('marine');
            expect(result).toEqual(mockCategories);
            // Uses --key=value format to prevent argument injection with dash-prefixed values
            expect(mockSpawn).toHaveBeenCalledWith(
                ['cockpit-container-apps', 'list-categories', '--store=marine'],
                expect.any(Object)
            );
        });
    });

    describe('listPackagesByCategory', () => {
        it('should call with category ID', async () => {
            const mockPackages = [
                {
                    name: 'signalk',
                    version: '1.0.0',
                    summary: 'Signal K Server',
                    section: 'marine',
                    installed: false,
                    upgradable: false,
                },
            ];

            const mockProc = {
                stream: vi.fn((callback) => {
                    callback(JSON.stringify(mockPackages));
                    return mockProc;
                }),
                done: vi.fn((callback) => {
                    callback();
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            const result = await listPackagesByCategory('navigation');
            expect(result).toEqual(mockPackages);
            expect(mockSpawn).toHaveBeenCalledWith(
                ['cockpit-container-apps', 'list-packages-by-category', 'navigation'],
                expect.any(Object)
            );
        });

        it('should call with category and store filter', async () => {
            const mockPackages = [
                {
                    name: 'signalk',
                    version: '1.0.0',
                    summary: 'Signal K Server',
                    section: 'marine',
                    installed: false,
                    upgradable: false,
                },
            ];

            const mockProc = {
                stream: vi.fn((callback) => {
                    callback(JSON.stringify(mockPackages));
                    return mockProc;
                }),
                done: vi.fn((callback) => {
                    callback();
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            const result = await listPackagesByCategory('navigation', 'marine');
            expect(result).toEqual(mockPackages);
            // Uses --key=value format to prevent argument injection with dash-prefixed values
            expect(mockSpawn).toHaveBeenCalledWith(
                [
                    'cockpit-container-apps',
                    'list-packages-by-category',
                    'navigation',
                    '--store=marine',
                ],
                expect.any(Object)
            );
        });
    });

    describe('filterPackages', () => {
        it('should build correct command arguments', async () => {
            const mockResponse = {
                packages: [],
                total_count: 0,
                applied_filters: [],
                limit: 1000,
                limited: false,
            };

            const mockProc = {
                stream: vi.fn((callback) => {
                    callback(JSON.stringify(mockResponse));
                    return mockProc;
                }),
                done: vi.fn((callback) => {
                    callback();
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            await filterPackages({
                store_id: 'marine',
                repository_id: 'marine:stable',
                tab: 'installed',
                search_query: 'signal',
                limit: 50,
            });

            // Uses --key=value format to prevent argument injection with dash-prefixed values
            expect(mockSpawn).toHaveBeenCalledWith(
                [
                    'cockpit-container-apps',
                    'filter-packages',
                    '--store=marine',
                    '--repo=marine:stable',
                    '--tab=installed',
                    '--search=signal',
                    '--limit=50',
                ],
                expect.any(Object)
            );
        });

        it('should work with no filters', async () => {
            const mockResponse = {
                packages: [],
                total_count: 0,
                applied_filters: [],
                limit: 1000,
                limited: false,
            };

            const mockProc = {
                stream: vi.fn((callback) => {
                    callback(JSON.stringify(mockResponse));
                    return mockProc;
                }),
                done: vi.fn((callback) => {
                    callback();
                    return mockProc;
                }),
                fail: vi.fn().mockReturnThis(),
                close: vi.fn().mockReturnThis(),
            };

            mockSpawn.mockReturnValue(mockProc);

            await filterPackages({});

            expect(mockSpawn).toHaveBeenCalledWith(
                ['cockpit-container-apps', 'filter-packages'],
                expect.any(Object)
            );
        });
    });

    describe('formatErrorMessage', () => {
        it('should format ContainerAppsError with details', () => {
            const error = new ContainerAppsError('Test error', 'TEST_CODE', 'Extra details');
            const message = formatErrorMessage(error);
            expect(message).toBe('Test error: Extra details');
        });

        it('should format ContainerAppsError without details', () => {
            const error = new ContainerAppsError('Test error', 'TEST_CODE');
            const message = formatErrorMessage(error);
            expect(message).toBe('Test error');
        });

        it('should format generic Error', () => {
            const error = new Error('Generic error');
            const message = formatErrorMessage(error);
            expect(message).toBe('Generic error');
        });

        it('should format unknown error', () => {
            const message = formatErrorMessage('String error');
            expect(message).toBe('String error');
        });
    });

    describe('installPackage error recovery', () => {
        const makeMockProc = () => {
            const cbs: {
                stream?: (data: string) => void;
                done?: (data: string | null) => void;
                fail?: (err: unknown, data: string | null) => void;
            } = {};
            const proc: any = {
                stream: (cb: any) => {
                    cbs.stream = cb;
                    return proc;
                },
                done: (cb: any) => {
                    cbs.done = cb;
                    return proc;
                },
                fail: (cb: any) => {
                    cbs.fail = cb;
                    return proc;
                },
                close: vi.fn().mockReturnThis(),
            };
            return { proc, cbs };
        };

        it('recovers pretty-printed backend error JSON from rawOutput on fail', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            // Stream emits a multi-line, indent-2 JSON object — the per-line
            // parser cannot reconstruct it, but the rawOutput scan must.
            cbs.stream!(
                '{\n  "error": "Failed to install package \'marine-avnav-container\'",\n' +
                    '  "code": "INSTALL_FAILED",\n  "details": "Mirror sync in progress?"\n}\n'
            );
            // Cockpit then signals failure with an empty error object.
            cbs.fail!({ problem: null, exit_status: 1, message: '' }, '');

            await expect(promise).rejects.toMatchObject({
                message: "Failed to install package 'marine-avnav-container'",
                code: 'INSTALL_FAILED',
                details: 'Mirror sync in progress?',
            });
        });

        it('maps Cockpit access-denied to a user-actionable message', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            cbs.fail!({ problem: 'access-denied', message: '' }, null);

            await expect(promise).rejects.toMatchObject({
                code: 'ACCESS_DENIED',
                message: expect.stringMatching(/Administrative access/i),
            });
        });

        it('uses the fallback message when no useful error data is available', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            cbs.fail!({ problem: null, message: '' }, null);

            await expect(promise).rejects.toMatchObject({
                code: 'INSTALL_FAILED',
                message: 'Install command failed',
            });
        });

        it('rejects on done when raw buffer contains an error object and no success', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            cbs.stream!(
                '{\n  "error": "Package not found",\n  "code": "NOT_FOUND",\n  "details": "x"\n}\n'
            );
            cbs.done!(null);

            await expect(promise).rejects.toMatchObject({
                code: 'NOT_FOUND',
                message: 'Package not found',
                details: 'x',
            });
        });

        it('closes the spawn channel after settlement on done', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            cbs.stream!('{"type":"progress","percentage":50,"message":"halfway"}\n');
            cbs.done!(null);
            await promise;
            expect(proc.close).toHaveBeenCalled();
        });

        it('closes the spawn channel after settlement on fail', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            cbs.fail!({ problem: 'access-denied', message: '' }, null);
            await promise.catch(() => undefined);
            expect(proc.close).toHaveBeenCalled();
        });

        it('ignores stream data delivered after settlement', async () => {
            const { proc, cbs } = makeMockProc();
            mockSpawn.mockReturnValue(proc);
            const promise = installPackage('marine-avnav-container');
            // Settle via success first.
            cbs.stream!('{"success":true}\n');
            await promise;
            // A late stream emission must not throw or change observed result.
            expect(() => cbs.stream!('{"error":"too late"}\n')).not.toThrow();
        });
    });
});

describe('extractJsonObjects', () => {
    it('returns empty for empty input', () => {
        expect(extractJsonObjects('')).toEqual([]);
    });

    it('parses a single balanced object', () => {
        expect(extractJsonObjects('{"a":1}')).toEqual([{ a: 1 }]);
    });

    it('parses two consecutive objects separated only by a newline', () => {
        expect(extractJsonObjects('{"a":1}\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('parses pretty-printed multi-line objects (indent=2)', () => {
        const text = '{\n  "error": "Failed",\n  "code": "X"\n}\n';
        expect(extractJsonObjects(text)).toEqual([{ error: 'Failed', code: 'X' }]);
    });

    it('treats nested objects as part of the outer object, not separate values', () => {
        const text = '{"outer":{"inner":1}}';
        expect(extractJsonObjects(text)).toEqual([{ outer: { inner: 1 } }]);
    });

    it('does not open a new block on a { inside a string value', () => {
        const text = '{"x":"{nope}"}';
        expect(extractJsonObjects(text)).toEqual([{ x: '{nope}' }]);
    });

    it('handles an escaped quote inside a string', () => {
        // JSON source: {"x":"a\"b"}  → JS literal needs \\\"
        const text = '{"x":"a\\"b"}';
        expect(extractJsonObjects(text)).toEqual([{ x: 'a"b' }]);
    });

    it('handles an escaped backslash at the end of a string', () => {
        // JSON source: {"x":"a\\"}  → JS literal needs \\\\
        const text = '{"x":"a\\\\"}';
        expect(extractJsonObjects(text)).toEqual([{ x: 'a\\' }]);
    });

    it('skips malformed JSON between good objects', () => {
        // The scanner walks balanced braces — the "garbage" between has no
        // braces, so it is silently passed over; the surrounding objects parse.
        const text = '{"a":1}garbage{"b":2}';
        expect(extractJsonObjects(text)).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('ignores an unclosed brace at the end of the buffer', () => {
        const text = '{"a":1}{"b":2';
        expect(extractJsonObjects(text)).toEqual([{ a: 1 }]);
    });
});

describe('findErrorInRawOutput', () => {
    it('returns null for empty input', () => {
        expect(findErrorInRawOutput('')).toBeNull();
    });

    it('returns null when no object carries a string error field', () => {
        expect(findErrorInRawOutput('{"type":"progress","percentage":50}')).toBeNull();
    });

    it('returns the trailing error when multiple objects are present', () => {
        const text = '{"type":"progress","percentage":50}\n{"error":"boom","code":"E"}';
        const err = findErrorInRawOutput(text);
        expect(err).toBeInstanceOf(ContainerAppsError);
        expect(err?.message).toBe('boom');
        expect(err?.code).toBe('E');
    });

    it('recovers a pretty-printed error block', () => {
        const text = '{\n  "error": "x",\n  "code": "Y",\n  "details": "d"\n}';
        const err = findErrorInRawOutput(text);
        expect(err?.message).toBe('x');
        expect(err?.code).toBe('Y');
        expect(err?.details).toBe('d');
    });
});
