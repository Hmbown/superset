import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const CLI_PATH = "dist/server/cli.mjs";

function supersetHomeDir(): string {
	return process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
}

/**
 * Copies the hub and the packages it loads out of the app bundle and removes
 * com.apple.quarantine from the copy. serve-sim injects a library from the hub
 * into the simulator process, which macOS checks like downloaded code, and a
 * quarantined copy is refused. The signed original stays in the bundle, which
 * notarization needs.
 */
async function materialize(unpackedPackageDir: string): Promise<string> {
	const manifest = JSON.parse(
		await readFile(join(unpackedPackageDir, "package.json"), "utf8"),
	) as { version: string; dependencies?: Record<string, string> };
	const root = join(supersetHomeDir(), "device-hub");
	const target = join(root, manifest.version);
	const packageDir = join(target, "node_modules", "expo-device-hub");
	if (existsSync(join(packageDir, CLI_PATH))) return packageDir;

	const staging = join(root, `.staging-${manifest.version}-${process.pid}`);
	await mkdir(root, { recursive: true });
	await rm(staging, { recursive: true, force: true });
	try {
		const nodeModules = dirname(unpackedPackageDir);
		for (const name of [
			"expo-device-hub",
			...Object.keys(manifest.dependencies ?? {}),
		]) {
			const source = join(nodeModules, name);
			if (!existsSync(source)) continue;
			await cp(source, join(staging, "node_modules", name), {
				recursive: true,
			});
		}
		await run("/usr/bin/xattr", ["-rd", "com.apple.quarantine", staging]);
		for (const entry of await readdir(root)) {
			if (entry !== manifest.version && !entry.startsWith(".staging-")) {
				await rm(join(root, entry), { recursive: true, force: true });
			}
		}
		try {
			await rename(staging, target);
		} catch (error) {
			// Another host-service on this machine may have finished first.
			if (!existsSync(join(packageDir, CLI_PATH))) throw error;
		}
		return packageDir;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

let cliPath: Promise<string> | undefined;

/** The hub's entry point. The packaged app ships it unpacked, since its
 * helpers and native addons cannot run from inside app.asar. */
export function deviceHubCli(): Promise<string> {
	cliPath ??= (async () => {
		const packageDir = dirname(
			createRequire(import.meta.url).resolve("expo-device-hub/package.json"),
		);
		const unpackedDir = packageDir.replace(
			`app.asar${sep}`,
			`app.asar.unpacked${sep}`,
		);
		const runDir =
			process.platform === "darwin" && unpackedDir !== packageDir
				? await materialize(unpackedDir)
				: unpackedDir;
		return join(runDir, CLI_PATH);
	})();
	cliPath.catch(() => {
		cliPath = undefined;
	});
	return cliPath;
}
