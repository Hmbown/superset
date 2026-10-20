import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { BOX_HOUR_GB_MINUTES } from "@superset/shared/billing";
import { Progress } from "@superset/ui/progress";
import { cloudTrpc } from "renderer/lib/cloud-trpc";

export function CloudUsageCard() {
	const { t } = useLingui();
	const { formatNumber, formatDate, formatList } = useFormat();
	const { data: usage } = cloudTrpc.billing.cloudUsage.useQuery(undefined);

	if (!usage) return null;

	const boxHours = (gbMinutes: number) => {
		const hours = gbMinutes / BOX_HOUR_GB_MINUTES;
		if (hours > 0 && hours < 0.1) return `<${formatNumber(0.1)}`;
		return formatNumber(hours, { maximumFractionDigits: 1 });
	};
	const used = boxHours(usage.usedGbMinutes);
	const included =
		usage.includedGbMinutes === null ? null : boxHours(usage.includedGbMinutes);
	const overage =
		usage.overageGbMinutes > 0 ? boxHours(usage.overageGbMinutes) : null;
	const resetDate = usage.resetsAt
		? formatDate(new Date(usage.resetsAt))
		: null;
	const sizeNames: Record<string, string> = {
		small: t({ message: "Small", context: "machine size" }),
		medium: t({ message: "Medium", context: "machine size" }),
		large: t({ message: "Large", context: "machine size" }),
	};
	const rates = formatList(
		usage.machineSizes.map(
			({ name, boxHoursPerHour }) =>
				`${sizeNames[name] ?? name} ${formatNumber(boxHoursPerHour, { maximumFractionDigits: 2 })}`,
		),
	);
	const percentUsed =
		usage.includedGbMinutes && usage.includedGbMinutes > 0
			? Math.min(100, (usage.usedGbMinutes / usage.includedGbMinutes) * 100)
			: 100;

	return (
		<div>
			<h3 className="text-sm font-medium mb-2">
				<Trans>Cloud usage</Trans>
			</h3>
			<div className="space-y-2 py-3">
				<div className="flex items-baseline justify-between gap-4 text-sm">
					<span className="tabular-nums">
						{included === null ? (
							<Trans>Box hours used: {used}</Trans>
						) : (
							<Trans>
								Box hours used: {used} of {included}
							</Trans>
						)}
					</span>
					{resetDate && (
						<span className="text-xs text-muted-foreground">
							<Trans>Resets {resetDate}</Trans>
						</span>
					)}
				</div>
				{usage.includedGbMinutes !== null && usage.includedGbMinutes > 0 && (
					<Progress value={percentUsed} />
				)}
				{overage && (
					<div className="text-xs text-warning tabular-nums">
						<Trans>Box hours over the plan: {overage}</Trans>
					</div>
				)}
				<div className="text-xs text-muted-foreground">
					<Trans>Box hours an hour: {rates}</Trans>
				</div>
			</div>
		</div>
	);
}
