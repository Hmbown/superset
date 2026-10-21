import { describe, expect, test } from "bun:test";
import type {
	LinkedIssue,
	LinkedPR,
} from "renderer/stores/new-workspace-draft";
import {
	findLinkedContextChips,
	hasToken,
	linkedContextOfChip,
	linkedContextPrompt,
	linkedIssueChip,
	linkedPRChip,
} from "./linkedContextChips";

const linear: LinkedIssue = {
	slug: "LIN-12",
	title: "Mic on wrong side",
	source: "linear",
	url: "https://linear.app/x/issue/LIN-12",
};
const github: LinkedIssue = {
	slug: "gh-42",
	title: "Crash on start",
	source: "github",
	url: "https://github.com/o/r/issues/42",
	number: 42,
	state: "open",
};
const pr: LinkedPR = {
	prNumber: 7,
	title: "Fix it",
	url: "https://github.com/o/r/pull/7",
	state: "open",
};

describe("linkedContextChips", () => {
	test("chips serialize to tokens the agent reads and carry the linked item", () => {
		expect(linkedIssueChip(linear)).toMatchObject({
			label: "LIN-12",
			serialized: "@LIN-12",
		});
		expect(linkedIssueChip(github)).toMatchObject({
			label: "#42",
			serialized: "@#42",
		});
		expect(linkedPRChip(pr)).toMatchObject({
			label: "PR #7",
			serialized: "@PR#7",
		});
		expect(linkedContextOfChip(linkedIssueChip(linear))).toEqual({
			kind: "issue",
			issue: linear,
		});
		expect(linkedContextOfChip(linkedPRChip(pr))).toEqual({
			kind: "pr",
			pr,
		});
		expect(linkedContextOfChip({ label: "x", serialized: "x" })).toBeNull();
	});

	test("finds linked tokens in a stored draft, and ignores longer ones", () => {
		const text = "@LIN-123 fix @LIN-12 and @PR#7 for @#42";
		expect(
			findLinkedContextChips(text, [linear, github], pr).map(
				({ chip, start, end }) => [chip.serialized, start, end],
			),
		).toEqual([
			["@LIN-12", 13, 20],
			["@PR#7", 25, 30],
			["@#42", 35, 39],
		]);
		expect(hasToken("@LIN-123", "@LIN-12")).toBe(false);
		expect(hasToken("see @LIN-12.", "@LIN-12")).toBe(true);
	});

	test("seeds a prompt with the PR first, then the issues", () => {
		expect(linkedContextPrompt([linear, github], pr)).toBe(
			"@PR#7 @LIN-12 @#42 ",
		);
		expect(linkedContextPrompt([])).toBe("");
	});
});
