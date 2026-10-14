import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getProjectConfigPath } from "../config";
import { compareWithCurrentSetup } from "./inspect";
import { asRecord } from "./limits";
import { IMPORTED_SCRIPT_KEYS, type SetupImportCandidate } from "./types";

export class SetupImportConflictError extends Error {
	constructor(fields: string[]) {
		super(`Import would replace the existing ${fields.join(", ")}`);
		this.name = "SetupImportConflictError";
	}
}

export class InvalidProjectConfigError extends Error {
	constructor(configPath: string) {
		super(`${configPath} is not a JSON object; fix it before importing`);
		this.name = "InvalidProjectConfigError";
	}
}

function readConfigObject(configPath: string): Record<string, unknown> {
	if (!existsSync(configPath)) return {};
	try {
		const parsed = asRecord(JSON.parse(readFileSync(configPath, "utf-8")));
		if (parsed) return parsed;
	} catch {}
	throw new InvalidProjectConfigError(configPath);
}

/**
 * Writes the candidate into `.superset/`. Refuses to replace an existing
 * field unless `overwrite` is set, and never touches keys it does not import.
 * Returns the repo-relative paths it wrote.
 */
export function applySetupImport(args: {
	repoPath: string;
	candidate: SetupImportCandidate;
	overwrite: boolean;
}): string[] {
	const { repoPath, candidate } = args;
	const { conflicts } = compareWithCurrentSetup(repoPath, candidate);
	if (conflicts.length > 0 && !args.overwrite) {
		throw new SetupImportConflictError(conflicts.map((c) => c.field));
	}

	const configPath = getProjectConfigPath(repoPath);
	const config = readConfigObject(configPath);
	mkdirSync(dirname(configPath), { recursive: true });

	const written: string[] = [];
	for (const key of IMPORTED_SCRIPT_KEYS) {
		const plan = candidate.scripts[key];
		if (!plan) continue;
		if (plan.scriptFile) {
			writeFileSync(
				join(repoPath, plan.scriptFile.path),
				plan.scriptFile.content,
				{
					encoding: "utf-8",
					mode: 0o755,
				},
			);
			written.push(plan.scriptFile.path);
		}
		config[key] = plan.commands;
	}
	if (candidate.cwd) config.cwd = candidate.cwd;

	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	written.push(".superset/config.json");

	for (const conflict of conflicts) {
		if (conflict.removesScriptFile && conflict.currentScriptFile) {
			rmSync(join(repoPath, conflict.currentScriptFile), { force: true });
		}
	}
	return written;
}
