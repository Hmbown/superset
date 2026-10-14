import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TARGET_PLATFORM = process.env.TARGET_PLATFORM ?? process.platform;
const TARGET_ARCH = process.env.TARGET_ARCH ?? process.arch;
const MINIMUM_MACOS = "12.0";
const SWIFT_ARCHS: Record<string, string> = { arm64: "arm64", x64: "x86_64" };

const desktopDir = resolve(import.meta.dirname, "..");
const source = resolve(desktopDir, "native/transcriber/main.swift");
const outfile = resolve(desktopDir, "dist/resources/bin/superset-transcriber");

function main() {
	if (TARGET_PLATFORM !== "darwin") {
		console.log("[transcriber] skipped: macOS only");
		return;
	}
	const arch = SWIFT_ARCHS[TARGET_ARCH];
	if (!arch) throw new Error(`[transcriber] unsupported arch ${TARGET_ARCH}`);
	mkdirSync(dirname(outfile), { recursive: true });
	const result = spawnSync(
		"xcrun",
		[
			"swiftc",
			"-O",
			"-target",
			`${arch}-apple-macos${MINIMUM_MACOS}`,
			source,
			"-o",
			outfile,
		],
		{ stdio: "inherit" },
	);
	if (result.status === 0) {
		console.log(`[transcriber] built ${outfile}`);
		return;
	}
	const reason = result.error?.message ?? `swiftc exited with ${result.status}`;
	// Without the helper, dictation falls back to the API's transcription.
	if (process.env.CI) throw new Error(`[transcriber] ${reason}`);
	console.warn(`[transcriber] skipped: ${reason}`);
}

main();
