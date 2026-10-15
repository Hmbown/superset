import { Trans } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { HiMiniPlus } from "react-icons/hi2";
import { LuLayers } from "react-icons/lu";

interface EnvironmentPickerEmptyStateProps {
	repositoryFullName?: string;
	onCreate: () => void;
}

export function EnvironmentPickerEmptyState({
	repositoryFullName,
	onCreate,
}: EnvironmentPickerEmptyStateProps) {
	return (
		<div className="flex flex-col items-center gap-3 px-4 pt-5 pb-4 text-center">
			<div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
				<LuLayers className="size-4 text-muted-foreground" />
			</div>
			<div className="flex flex-col gap-1">
				<p className="text-xs font-medium text-foreground">
					{repositoryFullName ? (
						<Trans>Set up {repositoryFullName} for the cloud</Trans>
					) : (
						<Trans>Set up an environment</Trans>
					)}
				</p>
				<p className="text-[11px] leading-4 text-muted-foreground">
					<Trans>
						An environment tells a cloud workspace which repositories to check
						out and how to install them.
					</Trans>
				</p>
			</div>
			<Button size="sm" className="h-7 w-full gap-1 text-xs" onClick={onCreate}>
				<HiMiniPlus className="size-3.5" />
				<Trans>Create environment</Trans>
			</Button>
		</div>
	);
}
