import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { useFormat } from "@superset/i18n/react";
import {
	GB_HOUR_PURCHASE_AMOUNT,
	type GbHourPack,
	gbHourPackPurchase,
	PLAN_PRICE_CURRENCY,
} from "@superset/shared/billing";
import { Button } from "@superset/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@superset/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { toast } from "@superset/ui/sonner";
import { Switch } from "@superset/ui/switch";
import { useState } from "react";
import { authClient } from "renderer/lib/auth-client";
import { cloudTrpc } from "renderer/lib/cloud-trpc";

const PRICE_FORMAT = { minimumFractionDigits: 0, maximumFractionDigits: 2 };
const HOURS_FORMAT = { maximumFractionDigits: 1 };
const THRESHOLDS_GB_HOURS = [50, 100, 250, 500, 1000];
const DEFAULT_AMOUNT = 60;
const NUMBER_INPUT_CLASS =
	"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

interface GbHourPurchaseProps {
	organizationId: string;
	pack: GbHourPack;
	autoTopup: {
		enabled: boolean;
		thresholdGbMinutes: number;
		quantityGbMinutes: number;
	} | null;
}

function parseAmount(value: string): number | null {
	const amount = Number(value);
	return Number.isInteger(amount) &&
		amount >= GB_HOUR_PURCHASE_AMOUNT.min &&
		amount <= GB_HOUR_PURCHASE_AMOUNT.max
		? amount
		: null;
}

export function GbHourPurchase({
	organizationId,
	pack,
	autoTopup,
}: GbHourPurchaseProps) {
	const { t } = useLingui();
	const { formatNumber, formatCurrency } = useFormat();
	const utils = cloudTrpc.useUtils();
	const snap = (value: number) => gbHourPackPurchase(pack, value).price;
	const [amountInput, setAmountInput] = useState(String(snap(DEFAULT_AMOUNT)));
	const [isBuying, setIsBuying] = useState(false);
	const [topupEnabled, setTopupEnabled] = useState(autoTopup?.enabled ?? false);
	const [thresholdGbHours, setThresholdGbHours] = useState(
		autoTopup ? Math.round(autoTopup.thresholdGbMinutes / 60) : 100,
	);
	const [topupAmount, setTopupAmount] = useState(
		autoTopup
			? Math.round((autoTopup.quantityGbMinutes / pack.gbMinutes) * pack.price)
			: snap(DEFAULT_AMOUNT),
	);
	const [topupAmountInput, setTopupAmountInput] = useState(String(topupAmount));

	const price = (value: number) =>
		formatCurrency(value, PLAN_PRICE_CURRENCY, PRICE_FORMAT);
	const currencySymbol = formatCurrency(0, PLAN_PRICE_CURRENCY, {
		maximumFractionDigits: 0,
	}).replace(/[\d\s.,]/g, "");
	const gbHours = (gbMinutes: number) =>
		formatNumber(gbMinutes / 60, HOURS_FORMAT);

	const amount = parseAmount(amountInput);
	const purchase = amount ? gbHourPackPurchase(pack, amount) : null;
	const topupPurchase = gbHourPackPurchase(pack, topupAmount);
	const packPrice = price(pack.price);
	const packGbMinutes = formatNumber(pack.gbMinutes);
	const packGbHours = gbHours(pack.gbMinutes);
	const minAmount = price(GB_HOUR_PURCHASE_AMOUNT.min);
	const maxAmount = price(GB_HOUR_PURCHASE_AMOUNT.max);
	const buyGbHours = purchase ? gbHours(purchase.gbMinutes) : null;

	const topupGbHours = gbHours(topupPurchase.gbMinutes);
	const topupPrice = price(topupPurchase.price);

	const refresh = () =>
		Promise.all([
			utils.billing.cloudUsage.invalidate(),
			utils.billing.activePlan.invalidate(),
		]);

	const snapAmountInput = () => {
		if (purchase) setAmountInput(String(purchase.price));
	};

	const buy = async () => {
		if (!purchase) return;
		setAmountInput(String(purchase.price));
		setIsBuying(true);
		try {
			await authClient.$fetch("/autumn/buyGbHours", {
				method: "POST",
				body: { organizationId, amount: purchase.price },
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

	const saveAutoTopup = async (next: {
		enabled: boolean;
		threshold: number;
		amount: number;
	}) => {
		const previous = {
			enabled: topupEnabled,
			threshold: thresholdGbHours,
			amount: topupAmount,
		};
		setTopupEnabled(next.enabled);
		setThresholdGbHours(next.threshold);
		setTopupAmount(next.amount);
		setTopupAmountInput(String(next.amount));
		try {
			await authClient.$fetch("/autumn/setAutoTopup", {
				method: "POST",
				body: {
					organizationId,
					enabled: next.enabled,
					thresholdGbHours: next.threshold,
					amount: next.amount,
				},
				throw: true,
			});
			await refresh();
		} catch (error) {
			setTopupEnabled(previous.enabled);
			setThresholdGbHours(previous.threshold);
			setTopupAmount(previous.amount);
			setTopupAmountInput(String(previous.amount));
			toast.error(errorMessage(error));
		}
	};

	const commitTopupAmount = () => {
		const parsed = parseAmount(topupAmountInput);
		const next = parsed ? snap(parsed) : null;
		if (!next) {
			setTopupAmountInput(String(topupAmount));
			return;
		}
		if (next === topupAmount) {
			setTopupAmountInput(String(next));
			return;
		}
		void saveAutoTopup({
			enabled: topupEnabled,
			threshold: thresholdGbHours,
			amount: next,
		});
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
							{packPrice} buys {packGbMinutes} GB-minutes ({packGbHours}{" "}
							GB-hours). Used after the monthly pool, and never expire.
						</Trans>
					</div>
					{!purchase && (
						<div className="text-xs text-destructive">
							<Trans>
								Enter a whole amount from {minAmount} to {maxAmount}.
							</Trans>
						</div>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<InputGroup className="w-[104px]">
						<InputGroupInput
							className={NUMBER_INPUT_CLASS}
							type="number"
							inputMode="numeric"
							min={GB_HOUR_PURCHASE_AMOUNT.min}
							max={GB_HOUR_PURCHASE_AMOUNT.max}
							step={pack.price}
							value={amountInput}
							onChange={(event) => setAmountInput(event.target.value)}
							onBlur={snapAmountInput}
							onKeyDown={(event) => {
								if (event.key === "Enter") void buy();
							}}
							aria-label={t`Amount to spend`}
						/>
						<InputGroupAddon>
							<InputGroupText>{currencySymbol}</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
					<Button size="sm" onClick={buy} disabled={isBuying || !purchase}>
						{buyGbHours ? (
							<Trans>Buy {buyGbHours} GB-hours</Trans>
						) : (
							<Trans>Buy</Trans>
						)}
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
							Buys {topupGbHours} GB-hours for {topupPrice} when fewer than the
							chosen number of GB-hours remain.
						</Trans>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Select
						value={String(thresholdGbHours)}
						onValueChange={(value) =>
							void saveAutoTopup({
								enabled: topupEnabled,
								threshold: Number(value),
								amount: topupAmount,
							})
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
					<InputGroup className="w-[104px]">
						<InputGroupInput
							className={NUMBER_INPUT_CLASS}
							type="number"
							inputMode="numeric"
							min={GB_HOUR_PURCHASE_AMOUNT.min}
							max={GB_HOUR_PURCHASE_AMOUNT.max}
							step={pack.price}
							value={topupAmountInput}
							disabled={!topupEnabled}
							onChange={(event) => setTopupAmountInput(event.target.value)}
							onBlur={commitTopupAmount}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur();
							}}
							aria-label={t`Auto top-up amount`}
						/>
						<InputGroupAddon>
							<InputGroupText>{currencySymbol}</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
					<Switch
						checked={topupEnabled}
						onCheckedChange={(enabled) =>
							void saveAutoTopup({
								enabled,
								threshold: thresholdGbHours,
								amount: topupAmount,
							})
						}
						aria-label={t`Auto top-up`}
					/>
				</div>
			</div>
		</div>
	);
}
