import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronRight, Clock, Plus } from "lucide-react";
import Image from "next/image";
import { BsMicrosoftTeams } from "react-icons/bs";
import { FaGithub } from "react-icons/fa";
import { LuWebhook } from "react-icons/lu";
import { SiLinear, SiNotion, SiSentry } from "react-icons/si";

const ICON = "size-3.5 shrink-0";

const PROVIDERS = [
	{
		id: "schedule",
		label: msg({ message: "Scheduled" }),
		icon: <Clock className={ICON} />,
	},
	{ id: "github", label: "GitHub", icon: <FaGithub className={ICON} /> },
	{
		id: "slack",
		label: "Slack",
		icon: <Image src="/plugins/slack-icon.svg" alt="" width={14} height={14} />,
	},
	{
		id: "teams",
		label: "Microsoft Teams",
		icon: <BsMicrosoftTeams className={ICON} />,
	},
	{ id: "sentry", label: "Sentry", icon: <SiSentry className={ICON} /> },
	{ id: "linear", label: "Linear", icon: <SiLinear className={ICON} /> },
	{
		id: "webhook",
		label: msg({ message: "Webhook triggered" }),
		icon: <LuWebhook className={ICON} />,
	},
	{ id: "notion", label: "Notion", icon: <SiNotion className={ICON} /> },
];

export function TriggerMenu() {
	const { t } = useLingui();

	return (
		<div className="absolute right-4 bottom-4 left-4 overflow-hidden rounded-md border border-border bg-popover text-sm shadow-xl sm:right-8 sm:bottom-8 sm:left-auto sm:w-96">
			<p className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 font-medium text-xs">
				<Plus className="size-3.5" />
				<Trans>Add Trigger</Trans>
			</p>
			<div className="grid grid-cols-2 gap-0.5 px-1.5 pb-1.5 text-xs">
				{PROVIDERS.map((provider) => {
					const selected = provider.id === "github";
					return (
						<span
							key={provider.id}
							className={`flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-1.5 ${selected ? "bg-accent text-foreground" : "text-muted-foreground"}`}
						>
							{provider.icon}
							<span className="truncate">
								{typeof provider.label === "string"
									? provider.label
									: t(provider.label)}
							</span>
							{selected && <ChevronRight className="ml-auto size-3 shrink-0" />}
						</span>
					);
				})}
			</div>
			<div className="hidden border-border border-t px-3 py-2.5 text-xs sm:block">
				<p className="text-foreground">
					<Trans>Pull request… › Review requested</Trans>
				</p>
			</div>
		</div>
	);
}
