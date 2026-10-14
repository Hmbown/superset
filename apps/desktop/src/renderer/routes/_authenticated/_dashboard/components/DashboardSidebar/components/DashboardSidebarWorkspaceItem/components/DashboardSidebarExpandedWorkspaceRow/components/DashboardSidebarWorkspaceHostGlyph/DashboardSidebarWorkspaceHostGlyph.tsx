import { Trans } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { LuMonitor, LuMonitorOff } from "react-icons/lu";
import type { DashboardSidebarWorkspaceHostType } from "../../../../../../types";

interface DashboardSidebarWorkspaceHostGlyphProps {
	hostType: DashboardSidebarWorkspaceHostType;
	hostIsOnline: boolean | null;
}

function CloudGlyph({ className }: { className?: string }) {
	return (
		<svg
			viewBox="1.5 1.2 13.5 13.5"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.1}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={className}
		>
			<path d="M4.5 12.5h7a3 3 0 0 0 .4-5.97A4 4 0 0 0 4.2 7.6A2.5 2.5 0 0 0 4.5 12.5Z" />
		</svg>
	);
}

/** Marks where a workspace runs; this device is the default and gets nothing. */
export function DashboardSidebarWorkspaceHostGlyph({
	hostType,
	hostIsOnline,
}: DashboardSidebarWorkspaceHostGlyphProps) {
	if (hostType === "local-device") return null;
	const isOffline = hostType === "remote-device" && hostIsOnline === false;

	return (
		<Tooltip delayDuration={500}>
			<TooltipTrigger asChild>
				<span
					className={cn(
						"flex size-5 shrink-0 items-center justify-center",
						isOffline ? "text-muted-foreground/40" : "text-muted-foreground/70",
					)}
				>
					{hostType === "cloud" ? (
						<CloudGlyph className="size-3" />
					) : isOffline ? (
						<LuMonitorOff className="size-3" strokeWidth={2} />
					) : (
						<LuMonitor className="size-3" strokeWidth={2} />
					)}
				</span>
			</TooltipTrigger>
			<TooltipContent side="top">
				{hostType === "cloud" ? (
					<Trans>Cloud workspace</Trans>
				) : isOffline ? (
					<Trans>Remote workspace — device offline</Trans>
				) : (
					<Trans>Remote workspace</Trans>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
