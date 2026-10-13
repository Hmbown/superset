import { describe, expect, test } from "bun:test";
import { taskListInputSchema, taskListPageInputSchema } from "./schema";

describe("task list filters", () => {
	test("keep the labels filter", () => {
		expect(taskListInputSchema.parse({ labels: ["acme"] })?.labels).toEqual([
			"acme",
		]);
		expect(taskListPageInputSchema.parse({ labels: ["acme"] }).labels).toEqual([
			"acme",
		]);
	});
});
