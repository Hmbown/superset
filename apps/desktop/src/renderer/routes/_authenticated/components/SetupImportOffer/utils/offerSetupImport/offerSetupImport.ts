export interface SetupImportOfferTarget {
	hostUrl: string;
	projectId: string;
	projectName: string;
}

export interface SetupImportOfferDeps {
	/** Only the org's last-focused window asks, so other windows stay quiet. */
	isPromptWindow: () => Promise<boolean>;
	waitForFocus: (signal: AbortSignal) => Promise<void>;
	isDismissed: (projectId: string) => boolean;
	/** The label of the setup to import, or null when there is nothing to offer. */
	findImport: (target: SetupImportOfferTarget) => Promise<string | null>;
	prompt: (target: SetupImportOfferTarget, label: string) => void;
}

export async function offerSetupImport(
	target: SetupImportOfferTarget,
	deps: SetupImportOfferDeps,
	signal: AbortSignal,
): Promise<void> {
	if (!(await deps.isPromptWindow())) return;
	await deps.waitForFocus(signal);
	if (signal.aborted || deps.isDismissed(target.projectId)) return;
	const label = await deps.findImport(target);
	if (!label || signal.aborted) return;
	deps.prompt(target, label);
}
