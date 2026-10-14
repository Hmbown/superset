import type { CaptureResult } from "posthog-js";

const DIRECT = "$direct";

const AUTH_PROVIDER_HOSTS = [
	/^accounts\.google\.[a-z.]+$/,
	/^accounts\.youtube\.com$/,
	/^(www\.)?github\.com$/,
	/^appleid\.apple\.com$/,
];

const REFERRER_KEYS = [
	["$referrer", "$referring_domain"],
	["$initial_referrer", "$initial_referring_domain"],
] as const;

function hostOf(value: unknown): string | null {
	if (typeof value !== "string" || value === DIRECT) return null;
	try {
		return new URL(value).hostname;
	} catch {
		return value;
	}
}

export function isAuthProviderHost(value: unknown): boolean {
	const host = hostOf(value);
	return host !== null && AUTH_PROVIDER_HOSTS.some((re) => re.test(host));
}

function replaceAuthProviderReferrer(
	props: Record<string, unknown> | undefined,
): void {
	if (!props) return;
	for (const [referrerKey, domainKey] of REFERRER_KEYS) {
		if (
			isAuthProviderHost(props[domainKey]) ||
			isAuthProviderHost(props[referrerKey])
		) {
			props[referrerKey] = DIRECT;
			props[domainKey] = DIRECT;
		}
	}
}

/**
 * The web app is where OAuth providers send people back, so a provider host
 * as referrer is the sign-in round trip, not where the visitor came from.
 * PostHog derives the person's first-touch properties from these fields.
 */
export function stripAuthProviderReferrer(
	event: CaptureResult | null,
): CaptureResult | null {
	if (!event) return event;
	replaceAuthProviderReferrer(event.properties);
	replaceAuthProviderReferrer(event.$set_once);
	return event;
}
