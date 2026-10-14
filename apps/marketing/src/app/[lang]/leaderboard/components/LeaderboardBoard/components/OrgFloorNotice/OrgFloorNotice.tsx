import { Trans } from "@lingui/react/macro";

interface OrgFloorNoticeProps {
	members: number;
	minMembers: number;
}

export function OrgFloorNotice({ members, minMembers }: OrgFloorNoticeProps) {
	return (
		<div className="border border-border p-12 text-center">
			<p className="text-sm text-muted-foreground">
				<Trans>
					Your organization's board opens once {minMembers} members are on the
					leaderboard. {members} so far.
				</Trans>
			</p>
			<p className="text-xs text-muted-foreground mt-2">
				<Trans>Opt in from Superset under Settings → Account.</Trans>
			</p>
		</div>
	);
}
