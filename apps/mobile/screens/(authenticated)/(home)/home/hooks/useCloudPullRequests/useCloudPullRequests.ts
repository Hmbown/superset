import type { RouterOutputs } from "@superset/trpc";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSession } from "@/lib/auth/client";
import { apiClient } from "@/lib/trpc/client";

const REFETCH_INTERVAL_MS = 30_000;

export type CloudPullRequest =
	RouterOutputs["cloudWorkspace"]["pullRequests"][number];

/**
 * Desktop's useCloudPullRequests: every pull request each cloud workspace's
 * box linked, read from the API rather than from the sandbox, so a list of
 * them wakes nothing.
 */
export function useCloudPullRequests({
	enabled,
}: {
	enabled: boolean;
}): ReadonlyMap<string, CloudPullRequest[]> {
	const { data: session } = useSession();
	const organizationId = session?.session?.activeOrganizationId ?? null;

	const { data } = useQuery({
		queryKey: ["cloud", "cloudWorkspace", "pullRequests", organizationId],
		enabled: enabled && organizationId !== null,
		refetchInterval: REFETCH_INTERVAL_MS,
		staleTime: 10_000,
		queryFn: () =>
			apiClient.cloudWorkspace.pullRequests.query({
				organizationId: organizationId as string,
			}),
	});

	return useMemo(() => {
		const byWorkspace = new Map<string, CloudPullRequest[]>();
		for (const pullRequest of data ?? []) {
			const rows = byWorkspace.get(pullRequest.cloudWorkspaceId);
			if (rows) rows.push(pullRequest);
			else byWorkspace.set(pullRequest.cloudWorkspaceId, [pullRequest]);
		}
		return byWorkspace;
	}, [data]);
}
