import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const USE_CASES: {
	path: string;
	name: MessageDescriptor;
	outcome: MessageDescriptor;
}[] = [
	{
		path: "/recipes/sentry-triage",
		name: msg({ message: "Launch watch" }),
		outcome: msg({
			message:
				"Every hour after a release, and whenever Sentry reports a new error, the agent checks what broke and opens draft fixes.",
		}),
	},
	{
		path: "/recipes/review-requested-prs",
		name: msg({ message: "PR review" }),
		outcome: msg({
			message:
				"When someone requests your review, the agent runs the tests and posts a review.",
		}),
	},
	{
		path: "/recipes/nightly-audit",
		name: msg({ message: "Nightly audit" }),
		outcome: msg({
			message:
				"Every night, the agent applies the safe dependency updates, runs the tests, and lists what needs a decision.",
		}),
	},
	{
		path: "/recipes/slack-bug-reports",
		name: msg({ message: "Bug reports" }),
		outcome: msg({
			message:
				"When someone posts in #bugs, the agent finds the code and tries to fix it.",
		}),
	},
];
