import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SidebarCardEntry } from "renderer/components/SidebarCardSlot";
import { useSetupImportCandidates } from "renderer/hooks/host-service/useSetupImportCandidates";
import { useOpenNewWorkspace } from "renderer/hooks/useOpenNewWorkspace";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { ImportSetupDialog } from "renderer/routes/_authenticated/components/ImportSetupDialog";
import { useNewWorkspaceDraftStore } from "renderer/stores/new-workspace-draft";
import { useV2SetupCardDismissalsStore } from "renderer/stores/v2-setup-card-dismissals";
import setupScriptPrompt from "./setup-script-prompt.md?raw";

export function useV2SetupScriptCard({
	hostUrl,
	projectId,
	projectName,
}: {
	hostUrl: string | null;
	projectId: string | null;
	projectName: string | null;
}): SidebarCardEntry | null {
	const { t } = useLingui();
	const openNewWorkspace = useOpenNewWorkspace();
	const isDismissed = useV2SetupCardDismissalsStore((s) =>
		projectId ? s.isDismissed(projectId) : false,
	);
	const dismiss = useV2SetupCardDismissalsStore((s) => s.dismiss);

	const { data: shouldShow } = useQuery({
		queryKey: ["host-config", "shouldShowSetupCard", hostUrl, projectId],
		queryFn: () => {
			if (!hostUrl || !projectId) throw new Error("no active host or project");
			return getHostServiceClientByUrl(
				hostUrl,
			).config.shouldShowSetupCard.query({ projectId });
		},
		enabled: !!hostUrl && !!projectId,
		refetchOnWindowFocus: true,
	});
	const importCandidates = useSetupImportCandidates({
		hostUrl,
		projectId,
		enabled: !!shouldShow && !isDismissed,
	});
	const [isImportOpen, setIsImportOpen] = useState(false);

	if (!hostUrl || !projectId || !projectName || isDismissed || !shouldShow) {
		return null;
	}

	const importCandidate = importCandidates[0];
	if (importCandidate) {
		const label = importCandidate.label;
		return {
			id: `setup-script-import:${projectId}`,
			badge: t({
				message: "Setup",
			}),
			title: t`Found ${label} setup`,
			description: t`Import its scripts to automate workspace setup for ${projectName}`,
			actionLabel: t`Import`,
			onAction: () => setIsImportOpen(true),
			onDismiss: () => dismiss(projectId),
			children: (
				<ImportSetupDialog
					open={isImportOpen}
					onOpenChange={setIsImportOpen}
					hostUrl={hostUrl}
					projectId={projectId}
					candidates={importCandidates}
				/>
			),
		};
	}

	return {
		id: `setup-script:${projectId}`,
		badge: t({
			message: "Setup",
		}),
		title: t({
			message: "Lifecycle scripts",
		}),
		description: t({
			message: `Automate workspace setup for ${projectName}`,
		}),
		actionLabel: t({
			message: "Configure",
		}),
		// Configure → open the new-workspace modal seeded with a prompt that walks
		// the agent through writing setup/teardown scripts for this project, rather
		// than sending the user to the settings page to hand-write config.json.
		onAction: () => {
			const draftStore = useNewWorkspaceDraftStore.getState();
			draftStore.resetDraft();
			draftStore.updateDraft({ prompt: setupScriptPrompt });
			openNewWorkspace(projectId);
		},
		onDismiss: () => dismiss(projectId),
	};
}
