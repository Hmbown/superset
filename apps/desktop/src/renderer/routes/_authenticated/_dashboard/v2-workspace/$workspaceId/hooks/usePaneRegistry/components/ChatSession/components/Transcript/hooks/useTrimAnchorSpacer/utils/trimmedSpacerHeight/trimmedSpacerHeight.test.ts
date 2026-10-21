import { expect, test } from "bun:test";
import { trimmedSpacerHeight } from "./trimmedSpacerHeight";

const viewport = { clientHeight: 500, scrollHeight: 1500 };

test("keeps a spacer that fills the bottom of the viewport", () => {
	expect(
		trimmedSpacerHeight({ ...viewport, scrollTop: 1000, spacerHeight: 300 }),
	).toBe(300);
});

test("keeps only the part of the spacer that is on screen", () => {
	expect(
		trimmedSpacerHeight({ ...viewport, scrollTop: 900, spacerHeight: 300 }),
	).toBe(200);
});

test("removes a spacer that is below the viewport", () => {
	expect(
		trimmedSpacerHeight({ ...viewport, scrollTop: 400, spacerHeight: 300 }),
	).toBe(0);
});
