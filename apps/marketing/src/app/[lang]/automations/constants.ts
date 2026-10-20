import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export type RunStepId = "write" | "trigger" | "run" | "review";

interface AutomationsItem {
	title: MessageDescriptor;
	description: MessageDescriptor;
}

export const RUN_STEPS: (AutomationsItem & { id: RunStepId })[] = [
	{
		id: "write",
		title: msg({ message: "Write." }),
		description: msg({
			message:
				"Write the prompt and pick the agent. Choose a project to work in, or run without one.",
		}),
	},
	{
		id: "trigger",
		title: msg({ message: "Trigger." }),
		description: msg({
			message:
				"Pick an event, like a review request or a new Sentry issue, or a schedule. One automation can have up to 25 triggers.",
		}),
	},
	{
		id: "run",
		title: msg({ message: "Run." }),
		description: msg({
			message:
				"When the event comes in or the schedule fires, the device you picked creates a new workspace. The agent starts on your prompt there.",
		}),
	},
	{
		id: "review",
		title: msg({ message: "Review." }),
		description: msg({
			message:
				"Open the run from Run History to see what the agent did. Reply in the same session to keep going.",
		}),
	},
];

export const DETAILS: AutomationsItem[] = [
	{
		title: msg({ message: "Runs on a device you choose" }),
		description: msg({
			message:
				"Each automation runs on the machine you pick. If it is offline when the automation fires, that run is missed.",
		}),
	},
	{
		title: msg({ message: "Works with your agents" }),
		description: msg({
			message: "Run any agent you set up in Superset, such as Claude or Codex.",
		}),
	},
	{
		title: msg({ message: "Scriptable from the CLI" }),
		description: msg({
			message:
				"Use superset automations to create and run automations from a script or from another agent.",
		}),
	},
	{
		title: msg({ message: "Part of Superset Pro" }),
		description: msg({
			message:
				"Automations need a Pro or Enterprise plan; Microsoft Teams triggers need Enterprise. If you downgrade, your automations stay but stop running.",
		}),
	},
];
