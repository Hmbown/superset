import { useCallback } from "react";
import { deriveBranchName } from "renderer/routes/_authenticated/utils/deriveBranchName";
import {
	hasToken,
	type LinkedContext,
	linkedIssueToken,
	linkedPRToken,
} from "renderer/routes/_authenticated/utils/linkedContextChips";
import { useNewWorkspaceDraftStore } from "renderer/stores/new-workspace-draft";
import type {
	DashboardNewWorkspaceDraft,
	LinkedIssue,
} from "../../../../../DashboardNewWorkspaceDraftContext";

function seedsWorkspaceNames(issue: LinkedIssue): boolean {
	return issue.source === "internal" || issue.source === "linear";
}

function isSameIssue(a: LinkedIssue, b: LinkedIssue): boolean {
	return a.source === "github" && b.source === "github"
		? a.number === b.number
		: a.slug === b.slug;
}

/**
 * Links and unlinks the draft's issues and PR. The composer's chips drive it:
 * inserting a chip links its item, and an item whose chip is gone from the
 * prompt is unlinked. Reads the store, not a render-time snapshot, so a link
 * and a prune in the same tick see each other.
 */
export function useLinkedContext(
	updateDraft: (patch: Partial<DashboardNewWorkspaceDraft>) => void,
) {
	const linkIssue = useCallback(
		(issue: LinkedIssue) => {
			const draft = useNewWorkspaceDraftStore.getState();
			if (draft.linkedIssues.some((linked) => isSameIssue(linked, issue)))
				return;
			const patch: Partial<DashboardNewWorkspaceDraft> = {
				linkedIssues: [...draft.linkedIssues, issue],
			};
			// Seed the workspace/branch fields from the issue so the branch
			// matches the provider's format (Linear autolinks it back to the
			// issue). Never overwrite something the user already typed.
			if (seedsWorkspaceNames(issue)) {
				if (!draft.branchNameEdited && !draft.branchName.trim()) {
					patch.branchName = deriveBranchName(issue);
					patch.branchNameEdited = true;
					patch.branchNameFromProvider = !!issue.branch?.trim();
				}
				if (!draft.workspaceNameEdited && !draft.workspaceName.trim()) {
					patch.workspaceName = issue.title;
					patch.workspaceNameEdited = true;
				}
			}
			updateDraft(patch);
		},
		[updateDraft],
	);

	const unlinkIssue = useCallback(
		(issue: LinkedIssue) => {
			const draft = useNewWorkspaceDraftStore.getState();
			const remaining = draft.linkedIssues.filter(
				(linked) => !isSameIssue(linked, issue),
			);
			const patch: Partial<DashboardNewWorkspaceDraft> = {
				linkedIssues: remaining,
			};
			// Clear the seeded names, but only when they still match what the
			// issue seeded — a user edit sticks. When another internal issue is
			// still linked, hand the seed to it instead of going blank.
			if (seedsWorkspaceNames(issue)) {
				const next = remaining.find(seedsWorkspaceNames);
				if (draft.branchName === deriveBranchName(issue)) {
					if (next) {
						patch.branchName = deriveBranchName(next);
						patch.branchNameEdited = true;
						patch.branchNameFromProvider = !!next.branch?.trim();
					} else {
						patch.branchName = "";
						patch.branchNameEdited = false;
						patch.branchNameFromProvider = false;
					}
				}
				if (draft.workspaceName === issue.title) {
					if (next) {
						patch.workspaceName = next.title;
						patch.workspaceNameEdited = true;
					} else {
						patch.workspaceName = "";
						patch.workspaceNameEdited = false;
					}
				}
			}
			updateDraft(patch);
		},
		[updateDraft],
	);

	const link = useCallback(
		(context: LinkedContext) => {
			if (context.kind === "pr") updateDraft({ linkedPR: context.pr });
			else linkIssue(context.issue);
		},
		[linkIssue, updateDraft],
	);

	const unlinkMissing = useCallback(
		(prompt: string) => {
			const draft = useNewWorkspaceDraftStore.getState();
			for (const issue of draft.linkedIssues) {
				if (!hasToken(prompt, linkedIssueToken(issue))) unlinkIssue(issue);
			}
			if (draft.linkedPR && !hasToken(prompt, linkedPRToken(draft.linkedPR)))
				updateDraft({ linkedPR: null });
		},
		[unlinkIssue, updateDraft],
	);

	return { link, unlinkMissing };
}
