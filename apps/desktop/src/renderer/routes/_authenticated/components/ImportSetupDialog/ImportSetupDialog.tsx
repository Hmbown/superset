import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { invalidateHostServiceQuery } from "@superset/workspace-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SetupImportCandidate } from "renderer/hooks/host-service/useSetupImportCandidates";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { ImportedScriptPreview } from "./components/ImportedScriptPreview";
import { NotImportedList } from "./components/NotImportedList";

const SCRIPT_KEYS = ["setup", "teardown", "run"] as const;

interface ImportSetupDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	hostUrl: string;
	projectId: string;
	candidates: SetupImportCandidate[];
	/** Adds a toast action that opens the project's scripts settings. */
	linkToSettings?: boolean;
}

export function ImportSetupDialog({
	open,
	onOpenChange,
	hostUrl,
	projectId,
	candidates,
	linkToSettings = false,
}: ImportSetupDialogProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [selectedSource, setSelectedSource] = useState<string | null>(null);
	const candidate =
		candidates.find((entry) => entry.source === selectedSource) ??
		candidates[0];

	const importMutation = useMutation({
		mutationFn: (input: {
			source: SetupImportCandidate["source"];
			overwrite: boolean;
		}) =>
			getHostServiceClientByUrl(hostUrl).config.importSetup.mutate({
				projectId,
				...input,
			}),
		onSuccess: (_, { source }) => {
			const label =
				candidates.find((entry) => entry.source === source)?.label ?? source;
			toast.success(t`Imported setup from ${label}`, {
				...(linkToSettings && {
					action: {
						label: t`View scripts`,
						onClick: () =>
							navigate({
								to: "/settings/projects/$projectId",
								params: { projectId },
							}),
					},
				}),
			});
			onOpenChange(false);
		},
		onError: (error) => toast.error(errorMessage(error)),
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: ["host-config"] });
			invalidateHostServiceQuery(hostUrl, [
				"config",
				"getWorkspaceRunDefinition",
			]);
		},
	});

	if (!candidate) return null;

	const label = candidate.label;
	const replaces = candidate.conflicts.length > 0;
	const conflictFor = (field: string) =>
		candidate.conflicts.find((conflict) => conflict.field === field);
	const cwdConflict = conflictFor("cwd");
	const fileList = candidate.files.join(", ");
	const currentCwd = cwdConflict?.current[0];
	const importedCwd = candidate.cwd;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="top-[8vh] flex max-h-[84vh] translate-y-0 flex-col sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						<Trans>Import setup from {label}</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							Superset writes these scripts to .superset/config.json in this
							project. Review them before you import.
						</Trans>
					</DialogDescription>
				</DialogHeader>

				{candidates.length > 1 && (
					<div className="flex flex-wrap gap-1.5">
						{candidates.map((entry) => (
							<Button
								key={entry.source}
								size="sm"
								variant={
									entry.source === candidate.source ? "secondary" : "ghost"
								}
								className={cn(
									"h-7 text-xs",
									entry.source === candidate.source && "font-semibold",
								)}
								onClick={() => setSelectedSource(entry.source)}
							>
								{entry.label}
							</Button>
						))}
					</div>
				)}

				<div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
					<p className="text-xs text-muted-foreground">
						<Trans>
							Read from <code className="font-mono">{fileList}</code>
						</Trans>
					</p>

					{SCRIPT_KEYS.map((key) => {
						const plan = candidate.scripts[key];
						if (!plan) return null;
						return (
							<ImportedScriptPreview
								key={key}
								scriptKey={key}
								plan={plan}
								conflict={conflictFor(key)}
							/>
						);
					})}

					{candidate.cwd && (
						<div className="space-y-1">
							<p className="text-sm font-medium">
								<Trans>Working directory</Trans>
							</p>
							<p className="text-xs text-muted-foreground">
								{currentCwd ? (
									<Trans>
										Replaces <code className="font-mono">{currentCwd}</code>{" "}
										with <code className="font-mono">{importedCwd}</code>
									</Trans>
								) : (
									<code className="font-mono">{importedCwd}</code>
								)}
							</p>
						</div>
					)}

					<NotImportedList entries={candidate.notImported} />
				</div>

				<DialogFooter className="items-center gap-2 sm:justify-between">
					<p className="text-xs text-muted-foreground">
						{replaces && (
							<Trans>This replaces part of your current Superset setup.</Trans>
						)}
					</p>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							<Trans>Cancel</Trans>
						</Button>
						<Button
							variant={replaces ? "destructive" : "default"}
							disabled={importMutation.isPending}
							onClick={() =>
								importMutation.mutate({
									source: candidate.source,
									overwrite: replaces,
								})
							}
						>
							{replaces ? (
								<Trans>Replace and import</Trans>
							) : (
								<Trans>Import</Trans>
							)}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
