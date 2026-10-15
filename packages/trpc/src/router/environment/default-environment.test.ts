import { describe, expect, test } from "bun:test";
import { pickDefaultEnvironment } from "./default-environment";

describe("pickDefaultEnvironment", () => {
	test("prefers the oldest environment that checks out only the repository", () => {
		expect(
			pickDefaultEnvironment([
				{ id: "mono", repositoryCount: 3 },
				{ id: "solo-old", repositoryCount: 1 },
				{ id: "solo-new", repositoryCount: 1 },
			])?.id,
		).toBe("solo-old");
	});

	test("falls back to the oldest environment that carries it at all", () => {
		expect(
			pickDefaultEnvironment([
				{ id: "mono-old", repositoryCount: 2 },
				{ id: "mono-new", repositoryCount: 4 },
			])?.id,
		).toBe("mono-old");
	});

	test("is undefined when nothing carries the repository", () => {
		expect(pickDefaultEnvironment([])).toBeUndefined();
	});
});
