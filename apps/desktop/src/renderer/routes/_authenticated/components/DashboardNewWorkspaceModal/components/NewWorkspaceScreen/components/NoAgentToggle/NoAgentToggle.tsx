import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { BotOffIcon } from "lucide-react";
import { FormPickerTrigger } from "../../../DashboardNewWorkspaceForm/PromptGroup/components/FormPickerTrigger";

export function NoAgentToggle({
	noAgent,
	onToggle,
}: {
	noAgent: boolean;
	onToggle: () => void;
}) {
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
