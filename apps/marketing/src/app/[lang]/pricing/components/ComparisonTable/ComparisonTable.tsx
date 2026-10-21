"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { Check, Minus } from "lucide-react";
import { useState } from "react";
import {
	COMPARISON_SECTIONS,
	type ComparisonRow,
	PRICING_TIERS,
	type PricingTier,
} from "../../constants";
import { comparisonValue, seatPrice } from "../../utils/planDisplay";
import type { PlanPrices } from "../../utils/planPricesFromAutumn";
import {
	type PlanPriceValues,
	planPriceValues,
} from "../../utils/planPriceValues";

interface ComparisonTableProps {
	prices: PlanPrices;
}

export function ComparisonTable({ prices }: ComparisonTableProps) {
	const { i18n } = useLingui();
	const values = planPriceValues(prices, i18n.locale);

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-col gap-3 text-center">
				<span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
					<Trans>Compare plans</Trans>
				</span>
				<h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
					<Trans>All features, side by side</Trans>
				</h2>
			</div>

			<DesktopTable values={values} />
			<MobileTable values={values} />
		</div>
	);
}

function DesktopTable({ values }: { values: PlanPriceValues }) {
	const { t } = useLingui();

	return (
		<div className="hidden md:block">
			<table className="w-full table-fixed border-separate border-spacing-0">
				<thead>
					<tr>
						<th className="sticky top-16 z-10 w-1/4 border-b border-border bg-background py-4 pr-4 text-left text-sm font-medium text-muted-foreground">
							<Trans>Features</Trans>
						</th>
						{PRICING_TIERS.map((tier) => (
							<th
								key={tier.id}
								className="sticky top-16 z-10 border-b border-border bg-background py-4 px-4 text-left text-sm font-medium text-foreground"
							>
								{t(tier.name)}
								<span className="block font-normal text-xs text-muted-foreground">
									<TierPriceLabel tier={tier} values={values} />
								</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{COMPARISON_SECTIONS.map((section) => (
						<DesktopSectionGroup key={section.id} title={t(section.title)}>
							{section.rows.map((row) => (
								<DesktopRow key={row.id} row={row} values={values} />
							))}
						</DesktopSectionGroup>
					))}
				</tbody>
			</table>
		</div>
	);
}

function TierPriceLabel({
	tier,
	values,
}: {
	tier: PricingTier;
	values: PlanPriceValues;
}) {
	if (tier.price.kind === "fixed") {
		return <>{tier.price.display}</>;
	}
	if (tier.price.kind === "seat") {
		const price = seatPrice(tier.price.plan, values, true).display;
		return values.plans[tier.price.plan].hasYearlyDiscount ? (
			<Trans>from {price}/user/mo</Trans>
		) : (
			<Trans>{price}/user/mo</Trans>
		);
	}
	return <Trans>Custom</Trans>;
}

function DesktopSectionGroup({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<>
			<tr>
				<td
					colSpan={PRICING_TIERS.length + 1}
					className="border-b border-border bg-accent/20 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					{title}
				</td>
			</tr>
			{children}
		</>
	);
}

function DesktopRow({
	row,
	values,
}: {
	row: ComparisonRow;
	values: PlanPriceValues;
}) {
	const { t } = useLingui();

	return (
		<tr>
			<td className="border-b border-border/60 py-4 pr-4 text-sm text-foreground">
				<div className="flex items-center gap-2">
					<span>{t(row.label)}</span>
					{row.badge && <RowBadge badge={row.badge} />}
				</div>
			</td>
			{PRICING_TIERS.map((tier) => (
				<td
					key={`${row.id}-${tier.id}`}
					className="border-b border-border/60 px-4 py-4 text-sm text-foreground"
				>
					<Cell value={comparisonValue(row, tier.id, values)} />
				</td>
			))}
		</tr>
	);
}

function MobileTable({ values }: { values: PlanPriceValues }) {
	const { t } = useLingui();
	const [selectedIndex, setSelectedIndex] = useState(1);
	const selectedTier = PRICING_TIERS[selectedIndex];
	if (!selectedTier) return null;

	return (
		<div className="flex flex-col gap-6 md:hidden">
			<div className="flex overflow-x-auto rounded-md border border-border bg-card p-1">
				{PRICING_TIERS.map((tier, index) => (
					<button
						key={tier.id}
						type="button"
						onClick={() => setSelectedIndex(index)}
						aria-pressed={index === selectedIndex}
						className={cn(
							"flex-1 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm font-medium transition-colors",
							index === selectedIndex
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{t(tier.name)}
					</button>
				))}
			</div>

			<div className="flex flex-col gap-6">
				{COMPARISON_SECTIONS.map((section) => (
					<section key={section.id} className="flex flex-col">
						<p className="mb-1 rounded-md bg-accent/20 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{t(section.title)}
						</p>
						<ul>
							{section.rows.map((row) => (
								<li
									key={row.id}
									className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-b-0"
								>
									<div className="flex items-center gap-2 text-sm text-foreground">
										<span>{t(row.label)}</span>
										{row.badge && <RowBadge badge={row.badge} />}
									</div>
									<div className="shrink-0 text-sm text-foreground">
										<Cell
											value={comparisonValue(row, selectedTier.id, values)}
										/>
									</div>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</div>
	);
}

function Cell({ value }: { value: ComparisonRow["values"][number] }) {
	const { t } = useLingui();

	if (value === true) {
		return (
			<Check
				className="size-4 text-foreground"
				aria-label={t({
					message: "Included",
				})}
			/>
		);
	}
	if (value === null || value === false) {
		return (
			<Minus
				className="size-4 text-muted-foreground"
				aria-label={t({
					message: "Not included",
				})}
			/>
		);
	}
	return <span>{typeof value === "string" ? value : t(value)}</span>;
}

function RowBadge({ badge }: { badge: NonNullable<ComparisonRow["badge"]> }) {
	const { t } = useLingui();
	const isPrimary = badge.variant === "default";
	return (
		<span
			className={cn(
				"rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
				isPrimary
					? "bg-foreground text-background"
					: "bg-accent/40 text-muted-foreground",
			)}
		>
			{t(badge.label)}
		</span>
	);
}
