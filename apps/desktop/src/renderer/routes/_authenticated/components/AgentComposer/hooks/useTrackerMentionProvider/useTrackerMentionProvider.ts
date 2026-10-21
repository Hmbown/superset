import { useLingui } from "@lingui/react/macro";
import type {
	ComposerMentionEntry,
	ComposerMentionProvider,
} from "@superset/chat-ui/PromptInput";
import { useMemo } from "react";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { useTaskTracker } from "renderer/hooks/useTaskTracker";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { TASK_PICKER_INPUT } from "renderer/routes/_authenticated/_dashboard/tasks/components/TasksView/hooks/useTasksData";
import { linkedContextChip } from "renderer/routes/_authenticated/utils/linkedContextChips";
import { linkedIssueFromLinear } from "renderer/routes/_authenticated/utils/linkedIssueFromLinear";
import type { LinkedIssue } from "renderer/stores/new-workspace-draft";
import { rankTasks } from "./rankTasks";

const MAX_RESULTS = 20;

function issueEntry(id: string, issue: LinkedIssue): ComposerMentionEntry {
	return {
		id,
		label: issue.slug,
		description: issue.title,
		keywords: [issue.title],
		select: (ctx) =>
			ctx.insertChip(linkedContextChip({ kind: "issue", issue })),
	};
}

/** The org's issue tracker as an @-mention source: Superset tasks or Linear. */
export function useTrackerMentionProvider(): ComposerMentionProvider | null {
	const { t } = useLingui();
	const tracker = useTaskTracker();
	const organizationId = useActiveOrganizationId();
	const utils = cloudTrpc.useUtils();

	return useMemo(() => {
		if (!tracker) return null;
		const source = {
			kind: "search" as const,
			emptyState: t({ message: "Search issues..." }),
			loadingState: t({ message: "Searching…" }),
		};
		if (tracker === "linear") {
			return {
				id: "linear",
				title: t({ message: "Linear" }),
				priority: 3,
				source: {
					...source,
					search: async (query: string) => {
						if (!organizationId) return [];
						const connection = await utils.integration.linear.getConnection
							.fetch({ organizationId })
							.catch(() => null);
						if (!connection || connection.needsReconnect) return [];
						const { issues } = await utils.integration.linear.issues.fetch({
							organizationId,
							status: "open",
							assignee: query ? null : "me",
							search: query || null,
						});
						return issues
							.slice(0, MAX_RESULTS)
							.map((issue) =>
								issueEntry(`linear:${issue.id}`, linkedIssueFromLinear(issue)),
							);
					},
				},
			};
		}
		return {
			id: "tasks",
			title: t({ message: "Tasks" }),
			priority: 3,
			source: {
				...source,
				search: async (query: string) => {
					const [page, statuses] = await Promise.all([
						utils.task.listPage.fetch(TASK_PICKER_INPUT),
						utils.task.statuses.list.fetch(),
					]);
					const statusTypes = new Map(
						statuses.map((status) => [status.id, status.type]),
					);
					return rankTasks(
						page.items.map(({ task }) => task),
						statusTypes,
						query,
						MAX_RESULTS,
					).map((task) =>
						issueEntry(`task:${task.id}`, {
							slug: task.slug,
							title: task.title,
							source: "internal",
							taskId: task.id,
							branch: task.branch ?? undefined,
						}),
					);
				},
			},
		};
	}, [tracker, organizationId, utils, t]);
}
