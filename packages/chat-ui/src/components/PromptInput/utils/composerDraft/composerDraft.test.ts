import { describe, expect, it } from "bun:test";
import { appendPastedText } from "@superset/chat/core";
import {
	chipFinder,
	draftFromText,
	EMPTY_DRAFT,
	mergeDrafts,
	placeChips,
} from "./composerDraft";

const issue = { label: "Fix the mic", serialized: "@SUP-12" };
const pr = { label: "PR 7", serialized: "@PR#7" };

describe("placeChips", () => {
	it("places repeated chips in order", () => {
		expect(placeChips("@SUP-12 and @SUP-12", [issue, issue])).toEqual([
			{ start: 0, end: 7, chip: issue },
			{ start: 12, end: 19, chip: issue },
		]);
	});
});

describe("draftFromText", () => {
	it("splits pasted blocks into cards unless told not to", () => {
		const message = appendPastedText("look", ["a log"]);
		expect(draftFromText(message)).toMatchObject({
			text: "look",
			pastedTexts: ["a log"],
		});
		expect(draftFromText(message, { splitPastes: false }).text).toBe(message);
	});
});

describe("mergeDrafts", () => {
	it("moves chips with their text and keeps every card and file", () => {
		const file = new File(["x"], "a.txt");
		const merged = mergeDrafts([
			{ ...EMPTY_DRAFT, text: "first", pastedTexts: ["log"] },
			{ ...EMPTY_DRAFT, attachments: [{ id: "a", file }] },
			{
				...EMPTY_DRAFT,
				text: "see @PR#7",
				chips: [{ start: 4, end: 9, chip: pr }],
			},
		]);
		expect(merged).toEqual({
			text: "first\n\nsee @PR#7",
			chips: [{ start: 11, end: 16, chip: pr }],
			pastedTexts: ["log"],
			attachments: [{ id: "a", file }],
		});
	});
});

describe("chipFinder", () => {
	it("matches whole tokens only", () => {
		const find = chipFinder([issue, pr]);
		expect(find("@SUP-12, @SUP-123 and x@PR#7 or @PR#7")).toEqual([
			{ start: 0, end: 7, chip: issue },
			{ start: 32, end: 37, chip: pr },
		]);
	});
});
