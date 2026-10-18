import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// scripts/eas-dev.sh opens the dev client with these flags so the dev menu
// does not open at launch and its floating button does not cover the header
// while an agent drives the app. An Expo bump that drops them brings both back
// without any error.
const devLauncherDir = dirname(
	require.resolve("expo-dev-launcher/package.json", {
		paths: [require.resolve("expo-dev-client/package.json")],
	}),
);

describe("expo-dev-launcher URL flags for agent-driven sessions", () => {
	test("disableAutoLaunch and disableFab update the dev menu preferences", () => {
		const source = readFileSync(
			join(devLauncherDir, "ios/EXDevLauncherURLHelper.swift"),
			"utf8",
		);
		expect(source).toMatch(
			/hasEnabledFlag\("disableFab", in: url\)\s*\{\s*DevMenuManager\.shared\.setShowFloatingActionButton\(false\)/,
		);
		expect(source).toMatch(
			/hasEnabledFlag\("disableAutoLaunch", in: url\)\s*\{\s*DevMenuPreferences\.isOnboardingFinished = true\s*DevMenuManager\.shared\.setShowsAtLaunch\(false\)/,
		);
	});
});
