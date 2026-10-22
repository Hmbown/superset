import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { BotOffIcon, Settings2Icon } from "lucide-react";
import { FormPickerTrigger } from "../../../DashboardNewWorkspaceForm/PromptGroup/components/FormPickerTrigger";

export function NoAgentToggle({
	noAgent,
	onToggle,
	onConfigureAgents,
}: {
	noAgent: boolean;
	onToggle: () => void;
	// Set when the host has no agents: there is nothing to toggle back to.
	onConfigureAgents?: () => void;
}) {
	if (onConfigureAgents) {
		return (
			<FormPickerTrigger className="shrink-0" onClick={onConfigureAgents}>
				<Settings2Icon className="size-3.5 shrink-0" />
				<span>
					<Trans>Configure agents…</Trans>
				</span>
			</FormPickerTrigger>
		);
	}
	return (
		<FormPickerTrigger
			aria-pressed={noAgent}
			className={cn("shrink-0", noAgent && "text-foreground")}
			onClick={onToggle}
		>
			<BotOffIcon className="size-3.5 shrink-0" />
			<span>
				<Trans>No agent</Trans>
			</span>
		</FormPickerTrigger>
	);
}
