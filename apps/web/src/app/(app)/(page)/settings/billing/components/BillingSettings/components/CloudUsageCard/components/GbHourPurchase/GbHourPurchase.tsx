"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { authClient } from "@superset/auth/client";
import { errorMessage } from "@superset/i18n/errors";
import { useFormat } from "@superset/i18n/react";
import { type GbHourPack, PLAN_PRICE_CURRENCY } from "@superset/shared/billing";
import { Button } from "@superset/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { toast } from "@superset/ui/sonner";
import { Switch } from "@superset/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/trpc/react";

const PRICE_FORMAT = { minimumFractionDigits: 0, maximumFractionDigits: 2 };
const PACK_COUNTS = [1, 2, 3, 5, 10];
const THRESHOLDS_GB_HOURS = [50, 100, 250, 500, 1000];

interface GbHourPurchaseProps {
	organizationId: string;
	pack: GbHourPack;
	autoTopup: {
		enabled: boolean;
		thresholdGbMinutes: number;
	} | null;
}

export function GbHourPurchase({
	organizationId,
	pack,
	autoTopup,
}: GbHourPurchaseProps) {
	const { t } = useLingui();
	const { formatNumber, formatCurrency } = useFormat();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [packs, setPacks] = useState(1);
	const [isBuying, setIsBuying] = useState(false);
	const [topupEnabled, setTopupEnabled] = useState(autoTopup?.enabled ?? false);
	const [thresholdGbHours, setThresholdGbHours] = useState(
		autoTopup ? Math.round(autoTopup.thresholdGbMinutes / 60) : 100,
	);

	const packGbHours = formatNumber(pack.gbMinutes / 60);
	const packPrice = formatCurrency(
		pack.price,
		PLAN_PRICE_CURRENCY,
		PRICE_FORMAT,
	);
	const buyGbHours = formatNumber((packs * pack.gbMinutes) / 60);
	const buyPrice = formatCurrency(
		packs * pack.price,
		PLAN_PRICE_CURRENCY,
		PRICE_FORMAT,
	);

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.billing.cloudUsage.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.billing.activePlan.queryKey(),
			}),
		]);

	const buy = async () => {
		setIsBuying(true);
		try {
			await authClient.$fetch("/autumn/buyGbHours", {
				method: "POST",
				body: { organizationId, packs },
				throw: true,
			});
			toast.success(t`Added ${buyGbHours} GB-hours.`);
			await refresh();
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setIsBuying(false);
		}
	};

	const saveAutoTopup = async (enabled: boolean, threshold: number) => {
		const previous = { enabled: topupEnabled, threshold: thresholdGbHours };
		setTopupEnabled(enabled);
		setThresholdGbHours(threshold);
		try {
			await authClient.$fetch("/autumn/setAutoTopup", {
				method: "POST",
				body: { organizationId, enabled, thresholdGbHours: threshold },
				throw: true,
			});
			await refresh();
		} catch (error) {
			setTopupEnabled(previous.enabled);
			setThresholdGbHours(previous.threshold);
			toast.error(errorMessage(error));
		}
	};

	return (
		<div className="space-y-4 border-t pt-4">
			<div className="flex items-center justify-between gap-4">
				<div className="min-w-0">
					<div className="text-sm">
						<Trans>Buy extra GB-hours</Trans>
					</div>
					<div className="text-xs text-muted-foreground">
						<Trans>
							{packGbHours} GB-hours for {packPrice}. Used after the monthly
							pool, and never expire.
						</Trans>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Select
						value={String(packs)}
						onValueChange={(value) => setPacks(Number(value))}
					>
						<SelectTrigger className="w-[72px]" aria-label={t`Packs`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PACK_COUNTS.map((count) => (
								<SelectItem key={count} value={String(count)}>
									{formatNumber(count)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button size="sm" onClick={buy} disabled={isBuying}>
						<Trans>Buy for {buyPrice}</Trans>
					</Button>
				</div>
			</div>
			<div className="flex items-center justify-between gap-4">
				<div className="min-w-0">
					<div className="text-sm">
						<Trans>Auto top-up</Trans>
					</div>
					<div className="text-xs text-muted-foreground">
						<Trans>
							Buys {packGbHours} GB-hours for {packPrice} when fewer than this
							many GB-hours remain.
						</Trans>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Select
						value={String(thresholdGbHours)}
						onValueChange={(value) =>
							void saveAutoTopup(topupEnabled, Number(value))
						}
						disabled={!topupEnabled}
					>
						<SelectTrigger className="w-[96px]" aria-label={t`Threshold`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{THRESHOLDS_GB_HOURS.map((threshold) => (
								<SelectItem key={threshold} value={String(threshold)}>
									{formatNumber(threshold)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Switch
						checked={topupEnabled}
						onCheckedChange={(enabled) =>
							void saveAutoTopup(enabled, thresholdGbHours)
						}
						aria-label={t`Auto top-up`}
					/>
				</div>
			</div>
		</div>
	);
}
