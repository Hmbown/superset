import { withPosthog } from "./lazy";
import { trackReddit } from "./reddit";

/**
 * PostHog events that also go to the Reddit Pixel, keyed by PostHog event name
 * → Reddit standard event. A download click shows intent, not a sale, so it is
 * a Lead and not a Purchase.
 */
const REDDIT_EVENT_MAP: Record<string, string> = {
	download_clicked: "Lead",
};

export function track(
	event: string,
	properties?: Record<string, unknown>,
): void {
	withPosthog((posthog) => posthog.capture(event, properties));

	const redditEvent = REDDIT_EVENT_MAP[event];
	if (redditEvent) {
		trackReddit(redditEvent, properties);
	}
}
