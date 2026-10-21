const SETTLE_MS = 1_000;
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60 * 1000;
const BATCH_SIZE = 200;

interface LinkedPullRequest {
	repository: string;
	number: number;
	linkedAt: number;
}

const keyOf = (pullRequest: LinkedPullRequest) =>
	`${pullRequest.repository.toLowerCase()}#${pullRequest.number}`;

/**
 * Sends the API each PR this box links, once: on boot for what is already
 * linked, then whenever the PR runtime links another. It retries only while a
 * send has failed.
 */
export function startSandboxPullRequestReporter(args: {
	apiUrl: string;
	workspaceId: string;
	hostSecret: string;
	read: () => Promise<LinkedPullRequest[]>;
	onLinked: (listener: () => void) => () => void;
}): () => void {
	const sent = new Set<string>();
	let retryMs = MIN_RETRY_MS;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let running = false;
	let rerun = false;
	let stopped = false;

	const sendBatch = async (batch: LinkedPullRequest[]) => {
		const response = await fetch(
			`${args.apiUrl}/api/cloud-workspaces/${args.workspaceId}/pull-requests`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${args.hostSecret}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ pullRequests: batch }),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) throw new Error(`answered ${response.status}`);
		for (const pullRequest of batch) sent.add(keyOf(pullRequest));
		const { ignored } = (await response.json().catch(() => ({}))) as {
			ignored?: string[];
		};
		if (ignored?.length) {
			console.warn(
				"[sandbox-pull-requests] not this workspace's repositories:",
				ignored.join(", "),
			);
		}
	};

	const report = async () => {
		timer = null;
		if (running) {
			rerun = true;
			return;
		}
		running = true;
		try {
			const unsent = (await args.read()).filter((pr) => !sent.has(keyOf(pr)));
			for (let i = 0; i < unsent.length && !stopped; i += BATCH_SIZE) {
				await sendBatch(unsent.slice(i, i + BATCH_SIZE));
			}
			retryMs = MIN_RETRY_MS;
		} catch (error) {
			console.warn(
				"[sandbox-pull-requests] report failed:",
				error instanceof Error ? error.message : error,
			);
			schedule(retryMs);
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
		} finally {
			running = false;
		}
		if (rerun) {
			rerun = false;
			schedule(SETTLE_MS);
		}
	};

	const schedule = (wait: number) => {
		if (stopped || timer) return;
		timer = setTimeout(() => void report(), wait);
	};

	const unsubscribe = args.onLinked(() => schedule(SETTLE_MS));
	void report();
	return () => {
		stopped = true;
		unsubscribe();
		if (timer) clearTimeout(timer);
	};
}
