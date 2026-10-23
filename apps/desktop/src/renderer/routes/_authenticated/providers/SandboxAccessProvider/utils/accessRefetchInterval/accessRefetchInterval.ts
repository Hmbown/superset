/** Re-mint with time to spare; a ticket lasts hours, so this is rare. */
const REFRESH_AT = 0.8;
export const ACCESS_RETRY_MS = 30_000;
// Every ready cloud workspace has one of these queries, so a failure that
// repeats (a refusal, a sandbox provider that won't answer) polls the API per
// workspace. Back off; the cap still picks up a grant or a recovery.
export const MAX_ERROR_RETRY_MS = 10 * 60 * 1000;

interface AccessQueryState {
	data?: { expiresAt: number };
	error?: unknown;
	errorUpdateCount?: number;
}

export function accessRefetchInterval(
	state: AccessQueryState,
	now = Date.now(),
): number {
	if (state.error) {
		const failures = Math.max(1, state.errorUpdateCount ?? 1);
		return Math.min(ACCESS_RETRY_MS * 2 ** (failures - 1), MAX_ERROR_RETRY_MS);
	}
	const expiresAt = state.data?.expiresAt;
	if (!expiresAt) return ACCESS_RETRY_MS;
	return Math.max(ACCESS_RETRY_MS, (expiresAt - now) * REFRESH_AT);
}
