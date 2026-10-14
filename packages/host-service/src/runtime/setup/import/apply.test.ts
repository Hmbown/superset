import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySetupImport, SetupImportConflictError } from "./apply";
import { compareWithCurrentSetup, inspectSetupImports } from "./inspect";

let repoPath: string;

beforeEach(() => {
	repoPath = mkdtempSync(join(tmpdir(), "setup-import-test-"));
});

afterEach(() => {
	rmSync(repoPath, { recursive: true, force: true });
});

function write(relativePath: string, content: string) {
	mkdirSync(join(repoPath, relativePath, ".."), { recursive: true });
	writeFileSync(join(repoPath, relativePath), content);
}

function readConfig() {
	return JSON.parse(
		readFileSync(join(repoPath, ".superset/config.json"), "utf-8"),
	);
}

function onlyCandidate() {
	const [candidate] = inspectSetupImports(repoPath);
	if (!candidate) throw new Error("expected a candidate");
	return candidate;
}

const conductorJson = JSON.stringify({
	scripts: { setup: "bun install", run: "bun dev" },
});

describe("inspectSetupImports", () => {
	it("returns every source found, in priority order", () => {
		write(
			"t3.json",
			JSON.stringify({ scripts: [{ name: "Dev", command: "bun dev" }] }),
		);
		write("conductor.json", conductorJson);
		expect(inspectSetupImports(repoPath).map((c) => c.source)).toEqual([
			"conductor",
			"t3",
		]);
	});

	it("skips a file over the size limit", () => {
		write(
			"conductor.json",
			JSON.stringify({ scripts: { setup: "x".repeat(300 * 1024) } }),
		);
		expect(inspectSetupImports(repoPath)).toEqual([]);
	});
});

describe("applySetupImport", () => {
	it("writes the imported fields and keeps other config keys", () => {
		write(
			".superset/config.json",
			JSON.stringify({ teardown: ["make clean"], custom: 1 }),
		);
		write("conductor.json", conductorJson);
		const candidate = onlyCandidate();

		expect(compareWithCurrentSetup(repoPath, candidate)).toEqual({
			changes: ["setup", "run"],
			conflicts: [],
		});
		expect(
			applySetupImport({ repoPath, candidate: candidate, overwrite: false }),
		).toEqual([".superset/config.json"]);
		expect(readConfig()).toEqual({
			teardown: ["make clean"],
			custom: 1,
			setup: ["bun install"],
			run: ["bun dev"],
		});
	});

	it("refuses to replace an existing field unless asked", () => {
		write(".superset/config.json", JSON.stringify({ setup: ["npm ci"] }));
		write("conductor.json", conductorJson);
		const candidate = onlyCandidate();

		expect(compareWithCurrentSetup(repoPath, candidate).conflicts).toEqual([
			{
				field: "setup",
				current: ["npm ci"],
				currentScriptFile: null,
				removesScriptFile: false,
			},
		]);
		expect(() =>
			applySetupImport({ repoPath, candidate: candidate, overwrite: false }),
		).toThrow(SetupImportConflictError);
		expect(readConfig().setup).toEqual(["npm ci"]);

		applySetupImport({ repoPath, candidate: candidate, overwrite: true });
		expect(readConfig().setup).toEqual(["bun install"]);
	});

	it("treats an existing .superset/setup.sh as a setup to replace", () => {
		write(".superset/setup.sh", "npm ci\n");
		write("conductor.json", conductorJson);
		const candidate = onlyCandidate();
		expect(compareWithCurrentSetup(repoPath, candidate).conflicts).toEqual([
			{
				field: "setup",
				current: [],
				currentScriptFile: ".superset/setup.sh",
				removesScriptFile: false,
			},
		]);
	});

	it("writes a multi-line script to .superset/setup.sh and runs it from config", () => {
		write(
			"conductor.json",
			JSON.stringify({
				scripts: {
					setup: "if [ ! -f .env ]; then\n  cp .env.example .env\nfi",
				},
			}),
		);
		const candidate = onlyCandidate();
		applySetupImport({ repoPath, candidate: candidate, overwrite: false });

		expect(readConfig().setup).toEqual([
			'bash "$SUPERSET_ROOT_PATH/.superset/setup.sh"',
		]);
		expect(
			readFileSync(join(repoPath, ".superset/setup.sh"), "utf-8"),
		).toContain("  cp .env.example .env\nfi\n");
		expect(compareWithCurrentSetup(repoPath, candidate)).toEqual({
			changes: [],
			conflicts: [],
		});
	});

	it("deletes the script an earlier import wrote when a new import replaces it", () => {
		write(
			"conductor.json",
			JSON.stringify({ scripts: { setup: "if [ -f x ]; then\n  echo x\nfi" } }),
		);
		applySetupImport({
			repoPath,
			candidate: onlyCandidate(),
			overwrite: false,
		});
		rmSync(join(repoPath, "conductor.json"));
		write(
			"t3.json",
			JSON.stringify({
				scripts: [
					{
						name: "Install",
						command: "bun install",
						runOnWorktreeCreate: true,
					},
				],
			}),
		);

		const candidate = onlyCandidate();
		expect(
			compareWithCurrentSetup(repoPath, candidate).conflicts[0]
				?.removesScriptFile,
		).toBe(true);
		applySetupImport({ repoPath, candidate, overwrite: true });
		expect(readConfig().setup).toEqual(["bun install"]);
		expect(existsSync(join(repoPath, ".superset/setup.sh"))).toBe(false);
	});

	it("keeps a hand-written .superset/setup.sh", () => {
		write(
			".superset/config.json",
			JSON.stringify({
				setup: ['bash "$SUPERSET_ROOT_PATH/.superset/setup.sh"'],
			}),
		);
		write(".superset/setup.sh", "#!/bin/bash\nnpm ci\n");
		write("conductor.json", conductorJson);
		const candidate = onlyCandidate();
		expect(
			compareWithCurrentSetup(repoPath, candidate).conflicts[0]
				?.removesScriptFile,
		).toBe(false);
		applySetupImport({ repoPath, candidate, overwrite: true });
		expect(existsSync(join(repoPath, ".superset/setup.sh"))).toBe(true);
	});
});
