import { Trans } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useState } from "react";
import { HiArrowDownTray } from "react-icons/hi2";
import { useSetupImportCandidates } from "renderer/hooks/host-service/useSetupImportCandidates";
import { ImportSetupDialog } from "renderer/routes/_authenticated/components/ImportSetupDialog";

interface SetupImportBannerProps {
	hostUrl: string;
	projectId: string;
}

export function SetupImportBanner({
	hostUrl,
	projectId,
}: SetupImportBannerProps) {
	const candidates = useSetupImportCandidates({ hostUrl, projectId });
	const [isOpen, setIsOpen] = useState(false);

	const first = candidates[0];
	if (!first) return null;
	const label = first.label;
	const file = first.files[0];

	return (
		<div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
			<p className="text-sm text-muted-foreground">
				{candidates.length > 1 ? (
					<Trans>Found setups from other tools in this project.</Trans>
				) : (
					<Trans>
						Found a {label} setup in <code className="font-mono">{file}</code>.
					</Trans>
				)}
			</p>
			<Button
				size="sm"
				variant="outline"
				className="h-7 shrink-0 gap-1.5 text-xs"
				onClick={() => setIsOpen(true)}
			>
				<HiArrowDownTray className="size-3.5" />
				<Trans>Import</Trans>
			</Button>
			<ImportSetupDialog
				open={isOpen}
				onOpenChange={setIsOpen}
				hostUrl={hostUrl}
				projectId={projectId}
				candidates={candidates}
			/>
		</div>
	);
}
