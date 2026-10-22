import { toast } from "@superset/ui/sonner";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Waits out the typing before a remote search. False when a newer keystroke
 * aborted this one, so the caller can skip the request.
 */
export async function settledQuery(
	signal: AbortSignal,
	delayMs = SEARCH_DEBOUNCE_MS,
): Promise<boolean> {
	if (signal.aborted) return false;
	await new Promise((resolve) => setTimeout(resolve, delayMs));
	return !signal.aborted;
}

const lastNotice = new Map<string, string>();

/** Toasts a search problem once, until the source succeeds again. */
export function noticeOnce(
	sourceId: string,
	message: string,
	kind: "error" | "info" = "error",
): void {
	if (lastNotice.get(sourceId) === message) return;
	lastNotice.set(sourceId, message);
	if (kind === "error") toast.error(message);
	else toast(message);
}

export function clearNotice(sourceId: string): void {
	lastNotice.delete(sourceId);
}
