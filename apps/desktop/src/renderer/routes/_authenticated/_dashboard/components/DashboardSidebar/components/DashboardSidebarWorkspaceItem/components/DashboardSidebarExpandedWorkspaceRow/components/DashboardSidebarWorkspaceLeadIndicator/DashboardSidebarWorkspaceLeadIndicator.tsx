import { WaveSpinner } from "@superset/ui/atoms/WaveSpinner";
import { cn } from "@superset/ui/utils";
import { LuCircle } from "react-icons/lu";
import { StatusIndicator } from "renderer/screens/main/components/StatusIndicator";
import type { ActivePaneStatus } from "shared/tabs-types";
import type {
	DashboardSidebarWorkspace,
	DashboardSidebarWorkspacePullRequest,
} from "../../../../../../types";
import {
	PR_COLOR_BY_STATE,
	PR_ICON_BY_STATE,
} from "../../../DashboardSidebarWorkspaceIcon";

interface DashboardSidebarWorkspaceLeadIndicatorProps {
	workspaceStatus: ActivePaneStatus | null;
	isCreatePending: boolean;
	sandboxStatus?: DashboardSidebarWorkspace["sandboxStatus"];
	pullRequestState: DashboardSidebarWorkspacePullRequest["state"] | null;
}

/**
 * One glyph by precedence: the sandbox's own state (nothing runs in a dead
 * or unborn box), then live agent state, then PR state, then idle.
 */
export function DashboardSidebarWorkspaceLeadIndicator({
	workspaceStatus,
	isCreatePending,
	sandboxStatus = null,
	pullRequestState,
}: DashboardSidebarWorkspaceLeadIndicatorProps) {
	if (sandboxStatus === "failed") {
		return <StatusIndicator status="failed" />;
	}
	if (isCreatePending || sandboxStatus === "provisioning") {
		return <WaveSpinner className="text-muted-foreground/60" />;
	}
	if (workspaceStatus === "working") {
		return <WaveSpinner className="text-foreground/80" />;
	}
	if (workspaceStatus) {
		return <StatusIndicator status={workspaceStatus} />;
	}
	if (pullRequestState) {
		const PrIcon = PR_ICON_BY_STATE[pullRequestState];
		return (
			<PrIcon
				className={cn("size-3", PR_COLOR_BY_STATE[pullRequestState])}
				strokeWidth={2}
			/>
		);
	}
	return (
		<LuCircle className="size-3 text-muted-foreground/40" strokeWidth={2} />
	);
}
