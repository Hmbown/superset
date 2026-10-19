import type { UsageLogEntry } from "./parse";
import { num } from "./parse";

export interface CursorUsageEvent {
	timestamp?: string;
	model?: string;
	conversationId?: string;
	tokenUsage?: {
		inputTokens?: number;
		outputTokens?: number;
		cacheReadTokens?: number;
		cacheWriteTokens?: number;
		totalCents?: number;
	};
	chargedCents?: number;
	subscriptionProductId?: string;
}

/** Grok Bot runs on Cursor accounts, so its turns arrive in the same feed.
 * The conversation is the Bot's agent id; trial credit grants are `sand-`
 * products even when the desktop app's roster is absent. */
export function isGrokBotEvent(
	event: CursorUsageEvent,
	grokBotAgentIds: ReadonlySet<string>,
): boolean {
	if (event.conversationId && grokBotAgentIds.has(event.conversationId)) {
		return true;
	}
	return /(^|-)sand(-|$)/.test(event.subscriptionProductId ?? "");
}

export function cursorEventsToEntries(
	events: CursorUsageEvent[],
	cutoffMs: number,
	grokBotAgentIds: ReadonlySet<string> = new Set(),
): UsageLogEntry[] {
	const entries: UsageLogEntry[] = [];
	for (const event of events) {
		const usage = event.tokenUsage;
		if (!usage) continue;
		const timestampMs = Number(event.timestamp);
		if (!Number.isFinite(timestampMs) || timestampMs < cutoffMs) continue;
		const cents = usage.totalCents ?? event.chargedCents;
		const costUsd =
			typeof cents === "number" && Number.isFinite(cents) && cents > 0
				? cents / 100
				: undefined;
		entries.push({
			agent: isGrokBotEvent(event, grokBotAgentIds) ? "grok-bot" : "cursor",
			model: event.model || "unknown",
			timestampMs,
			cwd: null,
			sessionId: event.conversationId || "unknown",
			// Cursor reports cache reads separately from inputTokens.
			uncachedInput: num(usage.inputTokens),
			cachedInput: num(usage.cacheReadTokens),
			cacheWrite5m: num(usage.cacheWriteTokens),
			cacheWrite1h: 0,
			output: num(usage.outputTokens),
			reasoningOutput: 0,
			...(costUsd !== undefined ? { costUsd } : {}),
		});
	}
	return entries;
}
