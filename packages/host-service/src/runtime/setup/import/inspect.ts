import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getProjectConfigPath } from "../config";
import { createRepoFileReader, parseJsonObject } from "./limits";
import { buildCandidate } from "./plan";
import { parseCmux } from "./sources/cmux";
import { parseCodex } from "./sources/codex";
import { parseConductor } from "./sources/conductor";
import { parseOrca } from "./sources/orca";
import { parseT3 } from "./sources/t3";
import {
	IMPORTED_SCRIPT_KEYS,
	type ImportedScriptKey,
	type SetupImportCandidate,
} from "./types";

const SOURCE_PARSERS = [
	parseConductor,
	parseOrca,
	parseCodex,
	parseCmux,
	parseT3,
] as const;

export interface SetupImportConflict {
	field: ImportedScriptKey | "cwd";
	/** What `.superset/config.json` holds today for this field. */
	current: string[];
	/** The `.superset/<key>.sh` the import replaces or shadows, if any. */
	currentScriptFile: string | null;
}

/** Every importable setup in the repo root, in priority order. */
export function inspectSetupImports(repoPath: string): SetupImportCandidate[] {
	const read = createRepoFileReader(repoPath);
	return SOURCE_PARSERS.flatMap((parse) => {
		const candidate = buildCandidate(parse(read));
		return candidate ? [candidate] : [];
	});
}

function readCurrentCommands(
	config: Record<string, unknown> | null,
	key: ImportedScriptKey,
): string[] {
	const value = config?.[key];
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is string => typeof item === "string" && item.trim() !== "",
	);
}

function readText(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

export interface SetupImportComparison {
	/** Fields the import would write a different value to. */
	changes: (ImportedScriptKey | "cwd")[];
	/** The subset of changes that replace something the project has today. */
	conflicts: SetupImportConflict[];
}

function sameCommands(a: string[], b: string[]): boolean {
	return (
		a.length === b.length && a.every((command, index) => command === b[index])
	);
}

export function compareWithCurrentSetup(
	repoPath: string,
	candidate: SetupImportCandidate,
): SetupImportComparison {
	const config = parseJsonObject(readText(getProjectConfigPath(repoPath)));
	const changes: SetupImportComparison["changes"] = [];
	const conflicts: SetupImportConflict[] = [];

	for (const key of IMPORTED_SCRIPT_KEYS) {
		const plan = candidate.scripts[key];
		if (!plan) continue;
		const current = readCurrentCommands(config, key);
		const scriptFile = `.superset/${key}.sh`;
		const scriptPath = join(repoPath, scriptFile);
		const scriptExists = existsSync(scriptPath);
		const scriptContent = scriptExists ? readText(scriptPath) : null;

		const commandsChange = !sameCommands(current, plan.commands);
		const scriptChanges = plan.scriptFile
			? scriptContent !== plan.scriptFile.content
			: false;
		if (!commandsChange && !scriptChanges) continue;
		changes.push(key);

		const replacesCommands = current.length > 0 && commandsChange;
		// Configured commands shadow `.superset/<key>.sh`, so writing commands
		// over an empty key still replaces a script that runs today.
		const replacesScript = plan.scriptFile
			? scriptExists && scriptChanges
			: scriptExists && current.length === 0;
		if (replacesCommands || replacesScript) {
			conflicts.push({
				field: key,
				current,
				currentScriptFile: scriptExists ? scriptFile : null,
			});
		}
	}

	const currentCwd = typeof config?.cwd === "string" ? config.cwd.trim() : "";
	if (candidate.cwd && currentCwd !== candidate.cwd) {
		changes.push("cwd");
		if (currentCwd) {
			conflicts.push({
				field: "cwd",
				current: [currentCwd],
				currentScriptFile: null,
			});
		}
	}
	return { changes, conflicts };
}
