import { describe, expect, test } from "bun:test";
import { settledQuery } from "./mentionSearch";

describe("settledQuery", () => {
	test("goes ahead when nothing aborted it", async () => {
		expect(await settledQuery(new AbortController().signal, 0)).toBe(true);
	});

	test("skips a search a newer keystroke aborted", async () => {
		const controller = new AbortController();
		const pending = settledQuery(controller.signal, 1);
		controller.abort();
		expect(await pending).toBe(false);
	});
});
