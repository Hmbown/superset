import { Trans } from "@lingui/react/macro";

interface EnvironmentMissingRepositoryNoticeProps {
	repositoryFullName: string;
	/** The account the org's GitHub App is installed on; null when GitHub is not connected. */
	installedAccountLogin: string | null;
	onConfigureGitHubApp: (() => void) | null;
}

export function EnvironmentMissingRepositoryNotice({
	repositoryFullName,
	installedAccountLogin,
	onConfigureGitHubApp,
}: EnvironmentMissingRepositoryNoticeProps) {
	const owner = repositoryFullName.split("/")[0] ?? "";
	const isOnInstalledAccount =
		installedAccountLogin !== null &&
		owner.toLowerCase() === installedAccountLogin.toLowerCase();

	return (
		<p className="px-1 text-xs leading-relaxed text-muted-foreground">
			{installedAccountLogin === null ? (
				<Trans>
					Connect GitHub in Integrations to add {repositoryFullName}.
				</Trans>
			) : isOnInstalledAccount ? (
				<Trans>
					{repositoryFullName} isn't shared with the Superset GitHub App yet.
				</Trans>
			) : (
				<Trans>
					{repositoryFullName} isn't on {installedAccountLogin}, where this
					organization's GitHub App is installed.
				</Trans>
			)}
			{onConfigureGitHubApp && (
				<>
					{" "}
					<button
						className="font-medium text-foreground underline-offset-2 hover:underline"
						onClick={onConfigureGitHubApp}
						type="button"
					>
						<Trans>Configure GitHub App →</Trans>
					</button>
				</>
			)}
		</p>
	);
}
