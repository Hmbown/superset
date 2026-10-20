import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const TRIGGER_GUIDES: { path: string; title: MessageDescriptor }[] = [
	{
		path: "/recipes/review-requested-prs",
		title: msg({ message: "Review PRs the moment you're asked" }),
	},
	{
		path: "/recipes/sentry-triage",
		title: msg({ message: "Triage new Sentry issues" }),
	},
	{
		path: "/recipes/slack-bug-reports",
		title: msg({ message: "Turn Slack bug reports into fixes" }),
	},
	{
		path: "/recipes/webhook-runs",
		title: msg({ message: "Start a run from any service" }),
	},
];
