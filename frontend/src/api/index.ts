/**
 * API wrapper for backend commands
 * Provides typed Promise-based interface to cockpit-container-apps CLI
 */

import type {
    APIError,
    Category,
    ConfigSchema,
    ConfigValues,
    FilterPackagesResponse,
    FilterParams,
    GetConfigResponse,
    GetConfigSchemaResponse,
    GetStoreDataResponse,
    ListStorePackagesResponse,
    Package,
    SetConfigResponse,
    Store,
    StorePackage,
} from './types';

/**
 * Custom error class for API errors
 */
export class ContainerAppsError extends Error {
    code?: string;
    details?: string;

    constructor(message: string, code?: string, details?: string) {
        super(message);
        this.name = 'ContainerAppsError';
        this.code = code;
        this.details = details;
    }
}

/**
 * Execute backend command and parse JSON response
 */
async function executeCommand<T>(
    command: string,
    args: string[] = [],
    timeout = 30000
): Promise<T> {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let settled = false; // Prevent race conditions

        const proc = cockpit.spawn(['cockpit-container-apps', command, ...args], {
            err: 'out',
            superuser: 'try',
        });

        // Set timeout
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    proc.close(() => {
                        reject(
                            new ContainerAppsError(
                                `Command timed out after ${timeout}ms`,
                                'TIMEOUT'
                            )
                        );
                    });
                }
            }, timeout);
        }

        proc.stream((data: string) => {
            stdout += data;
        });

        proc.done(() => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);

            try {
                // Parse JSON response
                const parsed = JSON.parse(stdout);

                // Check for error response
                if (parsed.error) {
                    const apiError = parsed as APIError;
                    reject(new ContainerAppsError(apiError.error, apiError.code, apiError.details));
                    return;
                }

                resolve(parsed as T);
            } catch (e) {
                reject(
                    new ContainerAppsError(
                        'Failed to parse backend response',
                        'PARSE_ERROR',
                        stdout
                    )
                );
            }
        });

        proc.fail((error: unknown, data: string | null) => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);

            const errorStr = String(error || data || '');

            // Try to parse error as JSON
            try {
                const parsed = JSON.parse(errorStr);
                if (parsed.error) {
                    const apiError = parsed as APIError;
                    reject(new ContainerAppsError(apiError.error, apiError.code, apiError.details));
                    return;
                }
            } catch {
                // Not JSON, treat as plain error message
            }

            reject(new ContainerAppsError(errorStr || 'Backend command failed', 'COMMAND_FAILED'));
        });
    });
}

/**
 * List all configured stores
 */
export async function listStores(): Promise<Store[]> {
    return executeCommand<Store[]>('list-stores');
}

/**
 * List all available store packages (installed and not installed)
 *
 * Returns store packages identified by the role::container-store tag.
 * Used by the store editor modal to enable/disable stores.
 */
export async function listStorePackages(): Promise<StorePackage[]> {
    const response = await executeCommand<ListStorePackagesResponse>('list-store-packages');
    return response.store_packages;
}

/**
 * List categories for a store (auto-discovered from package tags)
 *
 * Returns all count states (all, available, installed) in a single response,
 * enabling instant filter switching without reloading categories.
 */
export async function listCategories(storeId?: string): Promise<Category[]> {
    const args: string[] = [];
    if (storeId) {
        // Use --key=value format to prevent argument injection
        args.push(`--store=${storeId}`);
    }
    return executeCommand<Category[]>('list-categories', args);
}

/**
 * Get consolidated store data (configuration + packages + categories)
 *
 * This is a performance optimization that replaces three separate API calls:
 * - listStores() for store configuration
 * - listCategories() for category counts
 * - filterPackages() for package list
 *
 * The backend uses origin-based pre-filtering for optimal performance,
 * reducing iteration from 50,000+ packages to typically 20-1000 packages.
 *
 * Returns all packages for the store in a single call, enabling client-side
 * filtering for instant UI responses.
 */
export async function getStoreData(storeId: string): Promise<GetStoreDataResponse> {
    return executeCommand<GetStoreDataResponse>('get-store-data', [storeId]);
}

/**
 * List packages in a specific category
 */
export async function listPackagesByCategory(
    categoryId: string,
    storeId?: string
): Promise<Package[]> {
    const args = [categoryId];
    if (storeId) {
        // Use --key=value format to prevent argument injection
        args.push(`--store=${storeId}`);
    }
    return executeCommand<Package[]>('list-packages-by-category', args);
}

/**
 * Filter packages with cascade filtering
 */
export async function filterPackages(params: FilterParams = {}): Promise<FilterPackagesResponse> {
    // Use --key=value format for all parameters to prevent argument injection.
    // This prevents dash-prefixed values (e.g., "-test") from being interpreted
    // as separate command-line flags by the backend's argument parser.
    const args: string[] = [];

    if (params.store_id) {
        args.push(`--store=${params.store_id}`);
    }
    if (params.repository_id) {
        args.push(`--repo=${params.repository_id}`);
    }
    if (params.category_id) {
        args.push(`--category=${params.category_id}`);
    }
    if (params.tab) {
        args.push(`--tab=${params.tab}`);
    }
    if (params.search_query) {
        args.push(`--search=${params.search_query}`);
    }
    if (params.limit !== undefined) {
        args.push(`--limit=${params.limit.toString()}`);
    }

    return executeCommand<FilterPackagesResponse>('filter-packages', args);
}

/**
 * Progress callback for install/remove operations
 */
export interface ProgressCallback {
    (percentage: number, message: string): void;
}

/**
 * Run a privileged `cockpit-container-apps` subcommand that streams progress
 * lines and ends with either `{ success: true }` or a `{ error, code, details }`
 * payload. Resolves on success, rejects with a `ContainerAppsError` on any
 * failure (Cockpit channel error, backend error JSON, or process exit != 0).
 */
function runStreamingCommand(
    command: string[],
    onProgress: ProgressCallback | undefined,
    fallbackCode: string,
    fallbackMessage: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let rawOutput = '';
        let lineBuffer = '';

        const proc = cockpit.spawn(['cockpit-container-apps', ...command], {
            err: 'out',
            superuser: 'require',
        });

        proc.stream((data: string) => {
            rawOutput += data;
            lineBuffer += data;
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'progress' && onProgress) {
                        onProgress(parsed.percentage, parsed.message);
                    }
                    if (parsed.success && !settled) {
                        settled = true;
                        resolve();
                    }
                    if (parsed.error && !settled) {
                        settled = true;
                        reject(
                            new ContainerAppsError(parsed.error, parsed.code, parsed.details)
                        );
                    }
                } catch {
                    // Incomplete or non-JSON line; multi-line error JSON is
                    // recovered from `rawOutput` in done/fail handlers.
                }
            }
        });

        proc.done(() => {
            if (settled) return;
            settled = true;
            // Some flows finish without a `{ success: true }` marker (process
            // exits 0 with only progress lines). Treat that as success unless
            // the raw buffer holds a pretty-printed error object.
            const objects = extractJsonObjects(rawOutput);
            for (let i = objects.length - 1; i >= 0; i--) {
                const obj = objects[i];
                if (
                    obj &&
                    typeof obj === 'object' &&
                    'error' in obj &&
                    typeof (obj as { error: unknown }).error === 'string'
                ) {
                    const e = obj as { error: string; code?: string; details?: string };
                    reject(new ContainerAppsError(e.error, e.code, e.details));
                    return;
                }
            }
            resolve();
        });

        proc.fail((error: unknown, data: string | null) => {
            if (settled) return;
            settled = true;
            reject(buildSpawnFailureError(rawOutput, error, data, fallbackCode, fallbackMessage));
        });
    });
}

/**
 * Extract top-level JSON objects from a raw text buffer using brace matching.
 *
 * The backend pretty-prints error JSON across multiple lines (`json.dumps(...,
 * indent=2)`), so per-line `JSON.parse` does not see complete objects. This
 * scanner finds each balanced `{...}` block ignoring braces inside strings.
 */
function extractJsonObjects(text: string): unknown[] {
    const objects: unknown[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && inString) {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                try {
                    objects.push(JSON.parse(text.substring(start, i + 1)));
                } catch {
                    // Malformed block; skip.
                }
                start = -1;
            }
        }
    }
    return objects;
}

/**
 * Build a ContainerAppsError from a Cockpit `proc.fail` callback.
 *
 * The backend prints structured `{ error, code, details }` JSON to stderr on
 * failure. With `err: 'out'` Cockpit merges stderr into the stream callback,
 * but the per-line parser there cannot reconstruct pretty-printed JSON. Scan
 * the raw accumulated output for a complete error object before falling back
 * to Cockpit-level error info.
 */
function buildSpawnFailureError(
    rawOutput: string,
    error: unknown,
    data: string | null,
    fallbackCode: string,
    fallbackMessage: string
): ContainerAppsError {
    // 1. Scan raw output (including stderr merged via err:'out') for a backend
    //    error object. Walk objects in reverse so a trailing error wins over
    //    earlier progress entries.
    const blobs = [rawOutput, data ?? ''].filter(Boolean);
    for (const blob of blobs) {
        const objects = extractJsonObjects(blob);
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            if (
                obj &&
                typeof obj === 'object' &&
                'error' in obj &&
                typeof (obj as { error: unknown }).error === 'string'
            ) {
                const e = obj as { error: string; code?: string; details?: string };
                return new ContainerAppsError(e.error, e.code, e.details);
            }
        }
    }

    // 2. Surface Cockpit channel-level errors (access-denied, not-found, ...).
    if (error && typeof error === 'object') {
        const err = error as { message?: string; problem?: string };
        if (err.problem === 'access-denied') {
            return new ContainerAppsError(
                'Administrative access is required to perform this action.',
                'ACCESS_DENIED'
            );
        }
        if (err.message) return new ContainerAppsError(err.message, fallbackCode);
        if (err.problem) return new ContainerAppsError(err.problem, fallbackCode);
    }

    return new ContainerAppsError(fallbackMessage, fallbackCode);
}

/**
 * Install a package with progress reporting
 */
export async function installPackage(
    packageName: string,
    onProgress?: ProgressCallback
): Promise<void> {
    return runStreamingCommand(
        ['install', packageName],
        onProgress,
        'INSTALL_FAILED',
        'Install command failed'
    );
}

/**
 * Remove a package with progress reporting
 */
export async function removePackage(
    packageName: string,
    onProgress?: ProgressCallback
): Promise<void> {
    return runStreamingCommand(
        ['remove', packageName],
        onProgress,
        'REMOVE_FAILED',
        'Remove command failed'
    );
}

/**
 * Update APT package lists with progress reporting
 */
export async function updatePackageLists(onProgress?: ProgressCallback): Promise<void> {
    return runStreamingCommand(['update'], onProgress, 'UPDATE_FAILED', 'Update command failed');
}

/**
 * Handle for a live journal stream.
 * Call close() to stop streaming (e.g., on component unmount).
 */
export interface JournalStreamHandle {
    close: () => void;
}

/**
 * Stream systemd journal entries for a container app's service.
 *
 * Returns a handle with a close() method. The onLine callback is called
 * for each journal line received. The stream stays open (journalctl -f)
 * until close() is called or the process exits.
 */
export function streamServiceJournal(
    packageName: string,
    onLine: (line: string) => void,
    options?: { lines?: number; onError?: (message: string) => void; onClose?: () => void }
): JournalStreamHandle {
    const args = ['cockpit-container-apps', 'service-journal', packageName];
    if (options?.lines !== undefined) {
        args.push(`--lines=${options.lines}`);
    }

    const proc = cockpit.spawn(args, {
        err: 'message',
        superuser: 'try',
    });

    let buffer = '';
    let closed = false;

    proc.stream((data: string) => {
        buffer += data;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
            if (!rawLine.trim()) continue;

            try {
                const parsed = JSON.parse(rawLine);
                if (parsed.type === 'journal') {
                    onLine(parsed.line);
                }
            } catch {
                // Non-JSON line — pass through as-is
                onLine(rawLine);
            }
        }
    });

    proc.done(() => {
        if (!closed) {
            options?.onClose?.();
        }
    });

    proc.fail((error: unknown) => {
        if (!closed) {
            const message = error ? String(error) : 'Journal stream failed';
            options?.onError?.(message);
        }
    });

    return {
        close: () => {
            closed = true;
            proc.close('terminated');
        },
    };
}

/**
 * Get configuration schema for a package
 */
export async function getConfigSchema(packageName: string): Promise<ConfigSchema> {
    const response = await executeCommand<GetConfigSchemaResponse>('get-config-schema', [
        packageName,
    ]);
    if (!response.success || !response.schema) {
        throw new ContainerAppsError(
            response.error || 'Failed to load configuration schema',
            'SCHEMA_ERROR'
        );
    }
    return response.schema;
}

/**
 * Get current configuration values for a package
 */
export async function getConfig(packageName: string): Promise<ConfigValues> {
    const response = await executeCommand<GetConfigResponse>('get-config', [packageName]);
    if (!response.success || !response.config) {
        throw new ContainerAppsError(
            response.error || 'Failed to load configuration',
            'CONFIG_ERROR'
        );
    }
    return response.config;
}

/**
 * Set configuration values for a package
 * Returns warning message if service restart failed (config still saved)
 */
export async function setConfig(
    packageName: string,
    config: ConfigValues
): Promise<{ warning?: string }> {
    const response = await executeCommand<SetConfigResponse>('set-config', [
        packageName,
        JSON.stringify(config),
    ]);
    if (!response.success) {
        throw new ContainerAppsError(
            response.error || 'Failed to save configuration',
            'CONFIG_SAVE_ERROR',
            response.details
        );
    }
    return { warning: response.warning };
}

/**
 * Format error message for user display
 */
export function formatErrorMessage(error: unknown): string {
    if (error instanceof ContainerAppsError) {
        let message = error.message;
        if (error.details) {
            message += `: ${error.details}`;
        }
        return message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

// Re-export types for convenience
export type {
    APIError,
    Category,
    CategoryMetadata,
    ConfigField,
    ConfigGroup,
    ConfigSchema,
    ConfigValues,
    EnumOption,
    FieldType,
    FilterPackagesResponse,
    FilterParams,
    GetConfigResponse,
    GetConfigSchemaResponse,
    GetStoreDataResponse,
    ListStorePackagesResponse,
    Package,
    SetConfigResponse,
    Store,
    StoreFilters,
    StorePackage,
} from './types';
