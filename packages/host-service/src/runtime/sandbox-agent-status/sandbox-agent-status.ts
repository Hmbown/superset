import {
	type ActiveAgentStatus,
	agentStatusFromEvent,
	highestAgentStatus,
} from "@superset/shared/agent-status";
import type { TerminalAgentStore } from "../../terminal-agents/store";

const DEFAULT_TIMING = {
	settleMs: 2_000,
	minIntervalMs: 5_000,
	maxRetryMs: 60_000,
};

// A box is one workspace, so every binding on it counts.
export function startSandboxAgentStatusReporter(args: {
	apiUrl: string;
	workspaceId: string;
	hostSecret: string;
	store: TerminalAgentStore;
	timing?: typeof DEFAULT_TIMING;
}): () => void {
	const timing = args.timing ?? DEFAULT_TIMING;
	let lastSent: ActiveAgentStatus | null | undefined;
	let lastSentAt = 0;
	let retryMs = 0;
	let sending = false;
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const current = (): ActiveAgentStatus | null =>
		highestAgentStatus(
			args.store
				.list()
				.map((binding) => agentStatusFromEvent(binding.lastEventType)),
		);

	const send = async () => {
		timer = null;
		const status = current();
		if (status === lastSent) return;
		sending = true;
		lastSentAt = Date.now();
		try {
			const response = await fetch(
				`${args.apiUrl}/api/cloud-workspaces/${args.workspaceId}/agent-status`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${args.hostSecret}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({ status, at: lastSentAt }),
					signal: AbortSignal.timeout(10_000),
				},
			);
			if (!response.ok) throw new Error(`answered ${response.status}`);
			console.info(
				`[sandbox-agent-status] reported ${lastSent === undefined ? "unreported" : (lastSent ?? "none")} -> ${status ?? "none"}`,
			);
			lastSent = status;
			retryMs = 0;
		} catch (error) {
			retryMs = Math.min(
				Math.max(retryMs * 2, timing.minIntervalMs),
				timing.maxRetryMs,
			);
			console.warn(
				`[sandbox-agent-status] report of ${status ?? "none"} failed, retrying in ${retryMs}ms:`,
				error instanceof Error ? error.message : error,
			);
		} finally {
			sending = false;
		}
		schedule();
	};

	const schedule = () => {
		if (timer || sending || stopped) return;
		const wait = Math.max(
			timing.settleMs,
			timing.minIntervalMs - (Date.now() - lastSentAt),
			retryMs,
		);
		timer = setTimeout(() => void send(), wait);
	};

	args.store.on("change", schedule);
	schedule();
	return () => {
		stopped = true;
		args.store.off("change", schedule);
		if (timer) clearTimeout(timer);
	};
}
