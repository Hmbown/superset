import type { RouterOutputs } from "@superset/trpc";
import { useMemo } from "react";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { cloudTrpc } from "renderer/lib/cloud-trpc";

const CLOUD_PULL_REQUESTS_REFETCH_INTERVAL_MS = 30_000;

export type CloudPullRequestRecord =
	RouterOutputs["cloudWorkspace"]["pullRequests"][number];

export type CloudPullRequest = Pick<
	CloudPullRequestRecord,
	"url" | "number" | "title" | "state" | "isDraft" | "additions" | "deletions"
>;

export function useCloudPullRequests({ enabled }: { enabled: boolean }): {
	byWorkspace: ReadonlyMap<string, CloudPullRequestRecord[]>;
} {
	const organizationId = useActiveOrganizationId();
	const query = cloudTrpc.cloudWorkspace.pullRequests.useQuery(
		{ organizationId: organizationId ?? "" },
		{
			enabled: enabled && organizationId !== null,
			refetchInterval: CLOUD_PULL_REQUESTS_REFETCH_INTERVAL_MS,
			staleTime: 10_000,
		},
	);

	return useMemo(() => {
		const byWorkspace = new Map<string, CloudPullRequestRecord[]>();
		for (const row of query.data ?? []) {
			const rows = byWorkspace.get(row.cloudWorkspaceId);
			if (rows) rows.push(row);
			else byWorkspace.set(row.cloudWorkspaceId, [row]);
		}
		return { byWorkspace };
	}, [query.data]);
}
