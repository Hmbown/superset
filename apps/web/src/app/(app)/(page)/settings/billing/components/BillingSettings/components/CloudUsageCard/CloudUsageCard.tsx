"use client";

import { Trans } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { BOX_HOUR_GB_MINUTES } from "@superset/shared/billing";
import { Progress } from "@superset/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";

export function CloudUsageCard() {
	const trpc = useTRPC();
	const { formatNumber, formatDate } = useFormat();
	const { data: usage } = useQuery(trpc.billing.cloudUsage.queryOptions());

	if (!usage) return null;

	const boxHours = (gbMinutes: number) =>
		formatNumber(gbMinutes / BOX_HOUR_GB_MINUTES, {
			maximumFractionDigits: 1,
		});
	const used = boxHours(usage.usedGbMinutes);
	const included =
		usage.includedGbMinutes === null ? null : boxHours(usage.includedGbMinutes);
	const overage =
		usage.overageGbMinutes > 0 ? boxHours(usage.overageGbMinutes) : null;
	const resetDate = usage.resetsAt
		? formatDate(new Date(usage.resetsAt))
		: null;
	const percentUsed =
		usage.includedGbMinutes && usage.includedGbMinutes > 0
			? Math.min(100, (usage.usedGbMinutes / usage.includedGbMinutes) * 100)
			: 100;

	return (
		<div className="space-y-3 border-t pt-6">
			<div className="flex items-baseline justify-between gap-4">
				<div className="text-sm font-medium">
					<Trans>Cloud usage</Trans>
				</div>
				{resetDate && (
					<div className="text-sm text-muted-foreground">
						<Trans>Resets {resetDate}</Trans>
					</div>
				)}
			</div>
			<div className="text-sm tabular-nums">
				{included === null ? (
					<Trans>{used} box hours used</Trans>
				) : (
					<Trans>
						{used} of {included} box hours used
					</Trans>
				)}
			</div>
			{included !== null && <Progress value={percentUsed} />}
			{overage && (
				<div className="text-sm text-warning tabular-nums">
					<Trans>Overage: {overage} box hours</Trans>
				</div>
			)}
			<div className="text-sm text-muted-foreground">
				<Trans>Small uses ½, medium 1, large 2 box hours an hour</Trans>
			</div>
		</div>
	);
}
