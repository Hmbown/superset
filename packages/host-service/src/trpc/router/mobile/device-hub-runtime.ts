import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";

/** The hub's entry point. The packaged app ships it unpacked, since its
 * helpers and native addon cannot run from inside app.asar. */
export function deviceHubCli(): string {
	const packageDir = dirname(
		createRequire(import.meta.url).resolve("expo-device-hub/package.json"),
	);
	return join(
		packageDir.replace(`app.asar${sep}`, `app.asar.unpacked${sep}`),
		"dist/server/cli.mjs",
	);
}
