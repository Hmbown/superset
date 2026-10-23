import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { TEARDOWN_TIMEOUT_MS } from "@superset/shared/constants";
import { getManagedEnv } from "../sandbox-managed-env/sandbox-managed-env.ts";
import { resolveScript, shellSingleQuote } from "../setup/config";
import type { SandboxIdentity } from "./sandbox-self-seed";
import { buildStartHookEnv } from "./utils/buildStartHookEnv";

/** The same limit as a local archive, so `[archive]` has one documented cap. */
export const ARCHIVE_HOOK_TIMEOUT_MS = TEARDOWN_TIMEOUT_MS;
const OUTPUT_TAIL_BYTES = 4000;
const KILL_GRACE_MS = 2_000;

export type ArchiveHookResult =
	| { status: "ok"; outputTail: string }
	| { status: "skipped" }
	| {
			status: "failed";
			exitCode: number | null;
			timedOut: boolean;
			outputTail: string;
	  };

/**
 * Runs the repository's cloud `[archive]` commands before the box stops, so
 * outside resources `setup` created (a database branch, say) are released.
 * Commands run in one `&&` chain with the managed environment, like setup.
 */
export async function runSandboxArchiveHook(
	identity: SandboxIdentity,
	options: { timeoutMs?: number } = {},
): Promise<ArchiveHookResult> {
	const resolved = resolveScript("teardown", {
		repoPath: identity.worktreePath,
		projectId: identity.workspaceId,
	});
	if (!resolved) return { status: "skipped" };
	const command =
		resolved.kind === "commands"
			? resolved.commands.join(" && ")
			: `bash ${shellSingleQuote(resolved.scriptPath)}`;
	const configured = resolved.cwd
		? resolve(identity.worktreePath, resolved.cwd)
		: identity.worktreePath;

	return await new Promise<ArchiveHookResult>((done) => {
		let output = "";
		let timedOut = false;
		const child = spawn("bash", ["-lc", command], {
			cwd: existsSync(configured) ? configured : identity.worktreePath,
			env: buildStartHookEnv(process.env, getManagedEnv()),
			stdio: ["ignore", "pipe", "pipe"],
		});
		const collect = (chunk: Buffer) => {
			output = (output + chunk.toString()).slice(-OUTPUT_TAIL_BYTES);
		};
		child.stdout?.on("data", collect);
		child.stderr?.on("data", collect);
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
		}, options.timeoutMs ?? ARCHIVE_HOOK_TIMEOUT_MS);
		child.on("error", (error) => {
			clearTimeout(timer);
			done({
				status: "failed",
				exitCode: null,
				timedOut: false,
				outputTail: error.message,
			});
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			console.log(`[sandbox] archive hook exited ${code}: ${command}`);
			done(
				code === 0 && !timedOut
					? { status: "ok", outputTail: output }
					: { status: "failed", exitCode: code, timedOut, outputTail: output },
			);
		});
	});
}
