import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LuCheck, LuCopy, LuMaximize2, LuRefreshCw } from "react-icons/lu";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { useCopyToClipboard } from "renderer/hooks/useCopyToClipboard";
import {
	pullRequestDiffQueryKey,
	pullRequestThreadsQueryKey,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestCodeTab/utils/pullRequestCodeTabQueryKeys";
import { pullRequestDetailQueryKey } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestDetail";
import { usePullRequestsSplitViewStore } from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/pullRequestsSplitViewStore";
import { useWorkspace } from "renderer/routes/_authenticated/_dashboard/v2-workspace/providers/WorkspaceProvider";
import type { PullRequestPaneData } from "../../../../../../types";
import { usePullRequestPaneDetail } from "../../hooks/usePullRequestPaneDetail";

interface PullRequestPaneHeaderExtrasProps {
	data: PullRequestPaneData;
}

export function PullRequestPaneHeaderExtras({
	data,
}: PullRequestPaneHeaderExtrasProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { copyToClipboard, copied } = useCopyToClipboard();
	const detail = usePullRequestPaneDetail(data);
	const { hostUrl } = useWorkspace();
	const organizationId = useActiveOrganizationId();
	const isRefreshing =
		useIsFetching({
			queryKey: pullRequestDetailQueryKey({
				projectId: detail.projectId,
				hostUrl,
				prNumber: data.number,
			}),
		}) > 0;
	const url =
		detail.data?.url ??
		`https://github.com/${data.repoFullName}/pull/${data.number}`;
	const projectId = detail.projectId;
	const refresh = () => {
		void detail.refetch();
		for (const queryKey of [
			[["git", "getPullRequest"]],
			[["git", "getPullRequestThreads"]],
		]) {
			void queryClient.invalidateQueries({ queryKey });
		}
		const codeTabKey = {
			projectId: detail.projectId,
			hostUrl: hostUrl ?? "",
			prNumber: data.number,
		};
		void queryClient.invalidateQueries({
			queryKey: pullRequestDiffQueryKey({
				...codeTabKey,
				organizationId,
				repoFullName: data.repoFullName,
			}),
		});
		void queryClient.invalidateQueries({
			queryKey: pullRequestThreadsQueryKey(codeTabKey),
		});
	};
	const copyLabel = copied
		? t({ message: "Copied" })
		: t({ message: "Copy link to pull request" });

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={refresh}
						disabled={isRefreshing}
						aria-label={t({ message: "Refresh pull request" })}
						className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground disabled:pointer-events-none"
					>
						<LuRefreshCw
							className={
								isRefreshing
									? "size-3.5 animate-spin motion-reduce:animate-none"
									: "size-3.5"
							}
						/>
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<Trans>Refresh pull request</Trans>
				</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={() => {
							void copyToClipboard(url).catch(() => {
								toast.error(t({ message: "Failed to copy to clipboard" }));
							});
						}}
						aria-label={copyLabel}
						className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
					>
						{copied ? (
							<LuCheck className="size-3.5" />
						) : (
							<LuCopy className="size-3.5" />
						)}
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">{copyLabel}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={() => {
							// Same pair the PR list's own row click performs — the detail
							// pane may have been collapsed the last time the view was open.
							usePullRequestsSplitViewStore.getState().expandDetail();
							void navigate({
								to: "/pull-requests/$prNumber",
								params: { prNumber: String(data.number) },
								search: {
									project: projectId ?? undefined,
									repo: data.repoFullName,
								},
							});
						}}
						aria-label={t({
							message: "Open in Pull Requests",
						})}
						className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
					>
						<LuMaximize2 className="size-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<Trans>Open in Pull Requests</Trans>
				</TooltipContent>
			</Tooltip>
		</>
	);
}
