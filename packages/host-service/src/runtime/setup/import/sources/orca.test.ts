import { describe, expect, it } from "bun:test";
import { buildCandidate } from "../plan";
import { normalizeRelativePath, parseOrca } from "./orca";
import { readerFor } from "./test-utils";

const orcaYaml = `scripts:
  setup: |
    pnpm install
    cp "$ORCA_ROOT_PATH/.env" .env
  archive: docker compose down
setupAgentStartupPolicy: wait-for-setup
issueCommand: echo {{artifact_url}}
defaultTabs:
  - title: Agent
  - title: Web
    command: pnpm dev
  - title: Git
    command: git status
worktree:
  sharedDirectories:
    - .cache/
    - ../outside
environmentRecipes:
  - name: vm
`;

describe("parseOrca", () => {
	it("maps scripts and the first tab command", () => {
		const candidate = buildCandidate(
			parseOrca(readerFor({ "orca.yaml": orcaYaml })),
		);
		expect(candidate?.scripts.teardown).toEqual({
			commands: ["docker compose down"],
		});
		expect(candidate?.scripts.run).toEqual({ commands: ["pnpm dev"] });
		expect(candidate?.notImported.map((entry) => entry.field)).toEqual([
			"setupAgentStartupPolicy",
			"issueCommand",
			"environmentRecipes",
			"worktree.sharedDirectories[1]",
			"defaultTabs[2]",
		]);
	});

	it("links shared directories and copies .worktreeinclude paths before setup", () => {
		const candidate = buildCandidate(
			parseOrca(
				readerFor({
					"orca.yaml": orcaYaml,
					".worktreeinclude":
						"# secrets\n.env.local\n./.vscode/settings.json\n.cache\n*.pem\n",
				}),
			),
		);
		const script = candidate?.scripts.setup?.scriptFile?.content ?? "";
		expect(candidate?.files).toEqual(["orca.yaml", ".worktreeinclude"]);
		expect(script).toContain('  ln -s "$SUPERSET_ROOT_PATH/.cache" ".cache"');
		expect(script).toContain(
			'  mkdir -p ".vscode"\n  cp -R "$SUPERSET_ROOT_PATH/.vscode/settings.json" ".vscode/settings.json"',
		);
		expect(script).not.toContain('cp -R "$SUPERSET_ROOT_PATH/.cache"');
		expect(script.indexOf("ln -s")).toBeLessThan(script.indexOf("cp -R"));
		expect(script.indexOf("cp -R")).toBeLessThan(
			script.indexOf("pnpm install"),
		);
		expect(script).toContain('cp "$SUPERSET_ROOT_PATH/.env" .env');
		expect(candidate?.notImported).toContainEqual({
			file: ".worktreeinclude",
			field: "*.pem",
			reason: "invalid-path",
		});
	});

	it("imports a .worktreeinclude without an orca.yaml", () => {
		const parsed = parseOrca(readerFor({ ".worktreeinclude": ".env\n" }));
		expect(parsed?.files).toEqual([".worktreeinclude"]);
		expect(parsed?.scripts.setup?.[0]).toContain(
			'cp -R "$SUPERSET_ROOT_PATH/.env" ".env"',
		);
	});

	it("rejects a file with a duplicate key, as Orca does", () => {
		expect(
			parseOrca(
				readerFor({
					"orca.yaml": "scripts:\n  setup: a\nscripts:\n  setup: b\n",
				}),
			),
		).toBeNull();
	});
});

describe("normalizeRelativePath", () => {
	it("normalizes separators and rejects unsafe paths", () => {
		expect(normalizeRelativePath("./a\\b/")).toBe("a/b");
		for (const path of [
			"/etc",
			"C:/x",
			"a/../b",
			".git/config",
			"a//b",
			'a"b',
			"$HOME",
			"!x",
		]) {
			expect(normalizeRelativePath(path)).toBeNull();
		}
	});
});
