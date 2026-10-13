import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import {
	pullRequestDiffQueryKey,
	pullRequestThreadsQueryKey,
} from "../../components/PullRequestCodeTab/utils/pullRequestCodeTabQueryKeys";
import { pullRequestDetailQueryKey } from "../usePullRequestDetail";

interface RefreshPullRequestInput {
	projectId: string | null;
	hostUrl: string | null;
	prNumber: number | null;
	repoFullName: string | null;
}

export function useRefreshPullRequest({
	projectId,
	hostUrl,
	prNumber,
	repoFullName,
}: RefreshPullRequestInput) {
	const queryClient = useQueryClient();
	const organizationId = useActiveOrganizationId();
	const detailKey = pullRequestDetailQueryKey({ projectId, hostUrl, prNumber });
	const isRefreshing = useIsFetching({ queryKey: detailKey }) > 0;

	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: detailKey });
		if (prNumber === null) return;
		const codeTabKey = { projectId, hostUrl: hostUrl ?? "", prNumber };
		void queryClient.invalidateQueries({
			queryKey: pullRequestDiffQueryKey({
				...codeTabKey,
				organizationId,
				repoFullName,
			}),
		});
		void queryClient.invalidateQueries({
			queryKey: pullRequestThreadsQueryKey(codeTabKey),
		});
		for (const queryKey of [
			[["git", "getPullRequest"]],
			[["git", "getPullRequestThreads"]],
		]) {
			void queryClient.invalidateQueries({ queryKey });
		}
	};

	return { refresh, isRefreshing };
}
