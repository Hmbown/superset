import { describe, expect, test } from "bun:test";
import { rankTasks, type TaskCandidate } from "./rankTasks";

const task = (
	slug: string,
	title: string,
	statusId: string | null,
	updatedAt: string,
): TaskCandidate => ({
	id: slug,
	slug,
	title,
	statusId,
	updatedAt,
	branch: null,
});

const tasks = [
	task("SUP-1", "Mic on the wrong side", "todo", "2026-10-01"),
	task("SUP-2", "Fix the composer", "done", "2026-10-03"),
	task("SUP-3", "Composer drafts", null, "2026-10-02"),
];
const statuses = new Map([
	["todo", "unstarted"],
	["done", "completed"],
]);

describe("rankTasks", () => {
	test("without a query, lists open tasks newest first", () => {
		expect(rankTasks(tasks, statuses, "", 10).map((t) => t.slug)).toEqual([
			"SUP-3",
			"SUP-1",
		]);
	});

	test("with a query, fuzzy-matches open tasks only", () => {
		expect(
			rankTasks(tasks, statuses, "composer", 10).map((t) => t.slug),
		).toEqual(["SUP-3"]);
	});
});
