import { useCallback } from "react";
import { deriveBranchName } from "renderer/routes/_authenticated/utils/deriveBranchName";
import {
	findLinkedContextChips,
	type LinkedContext,
	linkedContextFromText,
	linkedIssueToken,
} from "renderer/routes/_authenticated/utils/linkedContextChips";
import {
	type NewWorkspaceDraft,
	useNewWorkspaceDraftStore,
} from "renderer/stores/new-workspace-draft";
import type {
	DashboardNewWorkspaceDraft,
	LinkedIssue,
} from "../../../../../DashboardNewWorkspaceDraftContext";

// Every issue and PR chipped into this draft, so a chip brought back by undo
// or a remount links again. Cleared with the draft.
const rememberedContexts = new Map<string, LinkedContext>();
useNewWorkspaceDraftStore.subscribe((state, prevState) => {
	if (state.resetKey !== prevState.resetKey) rememberedContexts.clear();
});

function seedsWorkspaceNames(issue: LinkedIssue): boolean {
	return issue.source === "internal" || issue.source === "linear";
}

function contextKey(context: LinkedContext): string {
	return context.kind === "pr"
		? `pr:${context.pr.prNumber}`
		: linkedIssueToken(context.issue);
}

export function rememberLinkedContext(context: LinkedContext): void {
	rememberedContexts.set(contextKey(context), context);
}

type LinkedContextDraft = Pick<
	NewWorkspaceDraft,
	| "linkedIssues"
	| "linkedPR"
	| "isSession"
	| "branchName"
	| "branchNameEdited"
	| "branchNameFromProvider"
	| "workspaceName"
	| "workspaceNameEdited"
>;

export function knownLinkedContexts(
	draft: Pick<NewWorkspaceDraft, "linkedIssues" | "linkedPR">,
): LinkedContext[] {
	return [
		...draft.linkedIssues.map((issue) => ({ kind: "issue" as const, issue })),
		...(draft.linkedPR ? [{ kind: "pr" as const, pr: draft.linkedPR }] : []),
		...rememberedContexts.values(),
	];
}

/**
 * The draft change that makes its linked issues and PR match the chips in
 * `prompt`, moving the seeded branch and workspace names with them. Null when
 * nothing changes.
 */
export function linkedContextPatch(
	draft: LinkedContextDraft,
	prompt: string,
	known: readonly LinkedContext[],
): Partial<DashboardNewWorkspaceDraft> | null {
	const next = linkedContextFromText(prompt, known);
	const pr = draft.isSession ? null : next.pr;
	const nextTokens = next.issues.map(linkedIssueToken);
	const currentTokens = draft.linkedIssues.map(linkedIssueToken);
	const issuesChanged = nextTokens.join(" ") !== currentTokens.join(" ");
	const prChanged = pr?.prNumber !== draft.linkedPR?.prNumber;
	if (!issuesChanged && !prChanged) return null;

	const patch: Partial<DashboardNewWorkspaceDraft> = {};
	if (prChanged) patch.linkedPR = pr;
	if (!issuesChanged) return patch;

	patch.linkedIssues = next.issues;
	const names = {
		branchName: draft.branchName,
		branchNameEdited: draft.branchNameEdited,
		branchNameFromProvider: draft.branchNameFromProvider,
		workspaceName: draft.workspaceName,
		workspaceNameEdited: draft.workspaceNameEdited,
	};
	const seedFrom = (issue: LinkedIssue | undefined) => {
		if (issue) {
			names.branchName = deriveBranchName(issue);
			names.branchNameEdited = true;
			names.branchNameFromProvider = !!issue.branch?.trim();
		} else {
			names.branchName = "";
			names.branchNameEdited = false;
			names.branchNameFromProvider = false;
		}
	};
	const nameFrom = (issue: LinkedIssue | undefined) => {
		names.workspaceName = issue?.title ?? "";
		names.workspaceNameEdited = issue !== undefined;
	};
	const remaining = next.issues.filter(seedsWorkspaceNames);
	// A name an unlinked issue seeded moves to the next issue still linked, or
	// clears; anything the user typed sticks.
	for (const issue of draft.linkedIssues) {
		if (!seedsWorkspaceNames(issue)) continue;
		if (nextTokens.includes(linkedIssueToken(issue))) continue;
		if (names.branchName === deriveBranchName(issue)) seedFrom(remaining[0]);
		if (names.workspaceName === issue.title) nameFrom(remaining[0]);
	}
	// A newly linked issue seeds the names the user has not touched.
	for (const issue of next.issues) {
		if (!seedsWorkspaceNames(issue)) continue;
		if (currentTokens.includes(linkedIssueToken(issue))) continue;
		if (!names.branchNameEdited && !names.branchName.trim()) seedFrom(issue);
		if (!names.workspaceNameEdited && !names.workspaceName.trim())
			nameFrom(issue);
	}
	return { ...patch, ...names };
}

/** The draft's linked issues and PR, driven by the composer's chips. */
export function useLinkedContext(
	updateDraft: (patch: Partial<DashboardNewWorkspaceDraft>) => void,
) {
	const sync = useCallback(
		(prompt: string) => {
			const draft = useNewWorkspaceDraftStore.getState();
			const patch = linkedContextPatch(
				draft,
				prompt,
				knownLinkedContexts(draft),
			);
			if (patch) updateDraft(patch);
		},
		[updateDraft],
	);

	const findChips = useCallback(
		(text: string) =>
			findLinkedContextChips(
				text,
				knownLinkedContexts(useNewWorkspaceDraftStore.getState()),
			),
		[],
	);

	return { remember: rememberLinkedContext, sync, findChips };
}
