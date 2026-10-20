import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { IconType } from "react-icons";
import { BsMicrosoftTeams } from "react-icons/bs";
import { FaGithub } from "react-icons/fa";
import { LuWebhook } from "react-icons/lu";
import { SiLinear, SiNotion, SiSentry } from "react-icons/si";

export interface TriggerSource {
	id: string;
	name: string;
	icon: { image: string } | { glyph: IconType; color?: string };
	// Event names as they read in the app's Add Trigger menu.
	events: MessageDescriptor[];
	note?: MessageDescriptor;
}

export const TRIGGER_SOURCES: TriggerSource[] = [
	{
		id: "github",
		name: "GitHub",
		icon: { glyph: FaGithub },
		events: [
			msg({ message: "Review requested" }),
			msg({ message: "Checks completed" }),
			msg({ message: "New push to branch" }),
			msg({ message: "Release published" }),
		],
	},
	{
		id: "slack",
		name: "Slack",
		icon: { image: "/plugins/slack-icon.svg" },
		events: [
			msg({ message: "Message in channel" }),
			msg({ message: "Reaction added" }),
			msg({ message: "Channel created" }),
		],
	},
	{
		id: "linear",
		name: "Linear",
		icon: { glyph: SiLinear, color: "#5E6AD2" },
		events: [
			msg({ message: "Issue created" }),
			msg({ message: "Issue moved" }),
			msg({ message: "Issue assigned" }),
		],
	},
	{
		id: "sentry",
		name: "Sentry",
		icon: { glyph: SiSentry, color: "#7553FF" },
		events: [
			msg({ message: "Issue created" }),
			msg({ message: "Issue resolved" }),
			msg({ message: "Issue assigned" }),
		],
	},
	{
		id: "notion",
		name: "Notion",
		icon: { glyph: SiNotion },
		events: [
			msg({ message: "Rows changed" }),
			msg({ message: "Comment added" }),
			msg({ message: "Comment mentions you" }),
		],
	},
	{
		id: "teams",
		name: "Microsoft Teams",
		icon: { glyph: BsMicrosoftTeams, color: "#5059C9" },
		events: [
			msg({ message: "Message in channel" }),
			msg({ message: "Channel created" }),
		],
		note: msg({ message: "Enterprise plan" }),
	},
	{
		id: "webhook",
		name: "Webhook",
		icon: { glyph: LuWebhook },
		events: [msg({ message: "A POST to the automation's URL" })],
	},
];
