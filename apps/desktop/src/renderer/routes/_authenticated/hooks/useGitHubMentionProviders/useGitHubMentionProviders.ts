import { useLingui } from "@lingui/react/macro";
import type { ComposerMentionProvider } from "@superset/chat-ui/PromptInput";
import { useMemo } from "react";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { linkedContextChip } from "renderer/routes/_authenticated/utils/linkedContextChips";

const MAX_RESULTS = 20;
const NO_PROVIDERS: ComposerMentionProvider[] = [];

/** The project's GitHub issues and pull requests as @-mention sources. */
export function useGitHubMentionProviders({
	projectId,
	hostUrl,
}: {
	projectId: string | null | undefined;
	hostUrl: string | null | undefined;
}): ComposerMentionProvider[] {
	const { t } = useLingui();
	return useMemo(() => {
		if (!projectId || !hostUrl) return NO_PROVIDERS;
		const client = () => getHostServiceClientByUrl(hostUrl);
		return [
			{
				id: "github-issues",
				title: t({ message: "GitHub issues" }),
				priority: 4,
				source: {
					kind: "search",
					emptyState: t({ message: "Search issues..." }),
					loadingState: t({ message: "Searching…" }),
					search: async (query) => {
						const result =
							await client().workspaceCreation.searchGitHubIssues.query({
								projectId,
								query: query || undefined,
								limit: MAX_RESULTS,
								includeClosed: false,
							});
						return result.issues.map((issue) => ({
							id: `github-issue:${issue.issueNumber}`,
							label: `#${issue.issueNumber}`,
							description: issue.title,
							keywords: [issue.title],
							select: (ctx) =>
								ctx.insertChip(
									linkedContextChip({
										kind: "issue",
										issue: {
											slug: `#${issue.issueNumber}`,
											title: issue.title,
											source: "github",
											url: issue.url,
											number: issue.issueNumber,
											state:
												issue.state.toLowerCase() === "closed"
													? "closed"
													: "open",
										},
									}),
								),
						}));
					},
				},
			},
			{
				id: "pull-requests",
				title: t({ message: "Pull requests" }),
				priority: 5,
				source: {
					kind: "search",
					emptyState: t({ message: "Search pull requests..." }),
					loadingState: t({ message: "Searching…" }),
					search: async (query) => {
						const result =
							await client().workspaceCreation.searchPullRequests.query({
								projectId,
								query: query || undefined,
								limit: MAX_RESULTS,
								includeClosed: false,
							});
						return result.pullRequests.map((pr) => ({
							id: `pull-request:${pr.prNumber}`,
							label: `PR #${pr.prNumber}`,
							description: pr.title,
							keywords: [pr.title],
							select: (ctx) =>
								ctx.insertChip(
									linkedContextChip({
										kind: "pr",
										pr: {
											prNumber: pr.prNumber,
											title: pr.title,
											url: pr.url,
											state: pr.isDraft ? "draft" : pr.state,
										},
									}),
								),
						}));
					},
				},
			},
		];
	}, [projectId, hostUrl, t]);
}
