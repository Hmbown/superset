import { useLingui } from "@lingui/react/macro";
import type {
	ComposerMentionEntry,
	ComposerMentionProvider,
} from "@superset/chat-ui/PromptInput";
import { type ReactNode, useMemo } from "react";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { SiLinear } from "react-icons/si";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { useTaskTracker } from "renderer/hooks/useTaskTracker";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { TASK_PICKER_INPUT } from "renderer/routes/_authenticated/_dashboard/tasks/components/TasksView/hooks/useTasksData";
import { linkedContextChip } from "renderer/routes/_authenticated/utils/linkedContextChips";
import { linkedIssueFromLinear } from "renderer/routes/_authenticated/utils/linkedIssueFromLinear";
import {
	clearNotice,
	noticeOnce,
	settledQuery,
} from "renderer/routes/_authenticated/utils/mentionSearch";
import type { LinkedIssue } from "renderer/stores/new-workspace-draft";
import { rankTasks } from "./rankTasks";

const MAX_RESULTS = 20;

function issueEntry(
	id: string,
	issue: LinkedIssue,
	icon: ReactNode,
): ComposerMentionEntry {
	return {
		id,
		icon,
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
					search: async (query: string, signal: AbortSignal) => {
						if (!organizationId) return [];
						if (!(await settledQuery(signal))) return [];
						const connection = await utils.integration.linear.getConnection
							.fetch({ organizationId })
							.catch(() => null);
						if (!connection || connection.needsReconnect) {
							noticeOnce(
								"linear",
								t({
									message:
										"Connect your Linear account in Settings → Integrations to link Linear issues.",
								}),
								"info",
							);
							return [];
						}
						const result = await utils.integration.linear.issues
							.fetch({
								organizationId,
								status: "open",
								assignee: query ? null : "me",
								search: query || null,
							})
							.catch((error: unknown) => {
								const msg =
									error instanceof Error ? error.message : String(error);
								noticeOnce(
									"linear",
									t({ message: `Couldn't load issues: ${msg}` }),
								);
								return null;
							});
						if (!result) return [];
						clearNotice("linear");
						return result.issues
							.slice(0, MAX_RESULTS)
							.map((issue) =>
								issueEntry(
									`linear:${issue.id}`,
									linkedIssueFromLinear(issue),
									<SiLinear className="size-3.5" />,
								),
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
				search: async (query: string, signal: AbortSignal) => {
					if (!(await settledQuery(signal))) return [];
					const loaded = await Promise.all([
						utils.task.listPage.fetch(TASK_PICKER_INPUT),
						utils.task.statuses.list.fetch(),
					]).catch((error: unknown) => {
						const msg = error instanceof Error ? error.message : String(error);
						noticeOnce("tasks", t({ message: `Couldn't load issues: ${msg}` }));
						return null;
					});
					if (!loaded) return [];
					clearNotice("tasks");
					const [page, statuses] = loaded;
					const statusTypes = new Map(
						statuses.map((status) => [status.id, status.type]),
					);
					return rankTasks(
						page.items.map(({ task }) => task),
						statusTypes,
						query,
						MAX_RESULTS,
					).map((task) =>
						issueEntry(
							`task:${task.id}`,
							{
								slug: task.slug,
								title: task.title,
								source: "internal",
								taskId: task.id,
								branch: task.branch ?? undefined,
							},
							<HiOutlineCheckCircle className="size-4" />,
						),
					);
				},
			},
		};
	}, [tracker, organizationId, utils, t]);
}
