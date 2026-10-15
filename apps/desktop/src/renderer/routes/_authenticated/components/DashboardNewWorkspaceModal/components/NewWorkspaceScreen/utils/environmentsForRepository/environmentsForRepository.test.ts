import { describe, expect, it } from "bun:test";
import { environmentsForRepository } from "./environmentsForRepository";

const env = (id: string, ...repos: string[]) => ({
	id,
	repositories: repos.map((fullName) => ({ fullName })),
});

describe("environmentsForRepository", () => {
	it("keeps every environment when no repository is chosen", () => {
		const all = [env("a", "o/one"), env("b", "o/two")];
		expect(environmentsForRepository(all, null)).toBe(all);
	});

	it("keeps environments that carry the repository, primary first, ignoring case", () => {
		const all = [
			env("secondary", "o/other", "O/Repo"),
			env("unrelated", "o/other"),
			env("primary", "o/repo"),
		];
		expect(
			environmentsForRepository(all, "o/repo").map((row) => row.id),
		).toEqual(["primary", "secondary"]);
	});
});
