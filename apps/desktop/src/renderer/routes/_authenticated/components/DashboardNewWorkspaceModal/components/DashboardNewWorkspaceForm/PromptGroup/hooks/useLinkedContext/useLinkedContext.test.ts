import { describe, expect, test } from "bun:test";
import type { LinkedContext } from "renderer/routes/_authenticated/utils/linkedContextChips";
import type {
	LinkedIssue,
	LinkedPR,
} from "renderer/stores/new-workspace-draft";
import { linkedContextPatch } from "./useLinkedContext";

const task: LinkedIssue = {
	slug: "SUP-12",
	title: "Fix the mic",
	source: "internal",
	taskId: "t-12",
};
const linear: LinkedIssue = {
	slug: "LIN-7",
	title: "Composer drafts",
	source: "linear",
	branch: "lin-7-composer-drafts",
};
const pr: LinkedPR = {
	prNumber: 7,
	title: "Fix it",
	url: "https://github.com/o/r/pull/7",
	state: "open",
};
const otherPr: LinkedPR = { ...pr, prNumber: 9, title: "Other" };

const known: LinkedContext[] = [
	{ kind: "issue", issue: task },
	{ kind: "issue", issue: linear },
	{ kind: "pr", pr },
	{ kind: "pr", pr: otherPr },
];

const emptyDraft = {
	linkedIssues: [] as LinkedIssue[],
	linkedPR: null as LinkedPR | null,
	isSession: false,
	branchName: "",
	branchNameEdited: false,
	branchNameFromProvider: false,
	workspaceName: "",
	workspaceNameEdited: false,
};

describe("linkedContextPatch", () => {
	test("links a chipped issue and seeds the untouched names from it", () => {
		expect(linkedContextPatch(emptyDraft, "@SUP-12 fix", known)).toEqual({
			linkedIssues: [task],
			branchName: "sup-12-fix-the-mic",
			branchNameEdited: true,
			branchNameFromProvider: false,
			workspaceName: "Fix the mic",
			workspaceNameEdited: true,
		});
	});

	test("hands the seeded names to the next issue when the first is unlinked", () => {
		const draft = {
			...emptyDraft,
			linkedIssues: [task, linear],
			branchName: "sup-12-fix-the-mic",
			branchNameEdited: true,
			workspaceName: "Fix the mic",
			workspaceNameEdited: true,
		};
		expect(linkedContextPatch(draft, "@LIN-7 only", known)).toEqual({
			linkedIssues: [linear],
			branchName: "lin-7-composer-drafts",
			branchNameEdited: true,
			branchNameFromProvider: true,
			workspaceName: "Composer drafts",
			workspaceNameEdited: true,
		});
	});

	test("keeps names the user typed when their issue is unlinked", () => {
		const draft = {
			...emptyDraft,
			linkedIssues: [task],
			branchName: "my-branch",
			branchNameEdited: true,
			workspaceName: "Mine",
			workspaceNameEdited: true,
		};
		expect(linkedContextPatch(draft, "no chips", known)).toMatchObject({
			linkedIssues: [],
			branchName: "my-branch",
			workspaceName: "Mine",
		});
	});

	test("relinks a PR whose chip came back by undo, and the last PR chip wins", () => {
		expect(linkedContextPatch(emptyDraft, "@PR#7 review", known)).toEqual({
			linkedPR: pr,
		});
		expect(
			linkedContextPatch({ ...emptyDraft, linkedPR: pr }, "@PR#7 @PR#9", known),
		).toEqual({ linkedPR: otherPr });
	});

	test("links no PR in a session", () => {
		expect(
			linkedContextPatch({ ...emptyDraft, isSession: true }, "@PR#7", known),
		).toBeNull();
	});

	test("changes nothing when the chips already match the draft", () => {
		expect(
			linkedContextPatch(
				{ ...emptyDraft, linkedIssues: [task], linkedPR: pr },
				"@PR#7 and @SUP-12",
				known,
			),
		).toBeNull();
	});
});
