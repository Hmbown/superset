import type { ReleaseNote } from "@superset/shared/release-notes";
import { coerce, compare, gte, lte, valid } from "semver";

/** Releases this build already includes, newest first. */
export function getShippedReleases(
	releases: ReleaseNote[],
	appVersion: string,
): ReleaseNote[] {
	const current = coerce(appVersion);
	if (!current) return [];
	return releases
		.filter(
			(release) => valid(release.version) && lte(release.version, current),
		)
		.sort((a, b) => compare(b.version, a.version));
}

/**
 * The card announces the newest shipped release, only to installs that have
 * updated at least once, until the user closes it or a newer one.
 */
export function getCardRelease(
	shipped: ReleaseNote[],
	{
		previousVersion,
		dismissedVersion,
	}: { previousVersion: string | null; dismissedVersion: string | null },
): ReleaseNote | null {
	const latest = shipped[0];
	if (!latest || !previousVersion) return null;
	if (dismissedVersion && valid(dismissedVersion)) {
		if (gte(dismissedVersion, latest.version)) return null;
	}
	return latest;
}
