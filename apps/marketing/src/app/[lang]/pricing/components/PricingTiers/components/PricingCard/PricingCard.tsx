import type { MessageDescriptor } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { Check } from "lucide-react";
import { DownloadLink } from "@/app/[lang]/components/DownloadLink";
import { TrackedLink } from "@/app/[lang]/components/TrackedLink";
import { env } from "@/env";
import type { PricingTier } from "../../../../constants";
import { checkoutHref } from "../../../../utils/checkoutHref";
import { seatPrice } from "../../../../utils/planDisplay";
import type { PlanPrices } from "../../../../utils/planPricesFromAutumn";
import {
	cloudHourValues,
	type PlanPriceValues,
	planPriceValues,
} from "../../../../utils/planPriceValues";

interface PricingCardProps {
	tier: PricingTier;
	isYearly: boolean;
	prices: PlanPrices;
	wide?: boolean;
}

export function PricingCard({
	tier,
	isYearly,
	prices,
	wide,
}: PricingCardProps) {
	const { t, i18n } = useLingui();
	const values = planPriceValues(prices, i18n.locale);
	const { display, strikethrough, note, cadence } = resolvePrice(
		tier,
		isYearly,
		values,
	);
	const overagePrice =
		tier.price.kind === "seat"
			? values.plans[tier.price.plan].overage
			: values.overagePrice;
	const featureValues =
		tier.price.kind === "seat"
			? cloudHourValues(values.plans[tier.price.plan])
			: undefined;

	return (
		<div
			className={cn(
				"flex flex-col gap-6 rounded-lg border p-6 md:p-8",
				wide && "md:col-span-2 lg:col-span-4",
				tier.highlight
					? "border-foreground/30 bg-accent/20"
					: "border-border bg-card/40",
			)}
		>
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-medium text-foreground">
						{t(tier.name)}
					</h3>
					{tier.highlight && (
						<span className="rounded-sm bg-foreground px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
							<Trans>Popular</Trans>
						</span>
					)}
				</div>
				<p className="text-sm text-muted-foreground">{t(tier.description)}</p>
			</div>

			<div className="flex flex-col gap-1">
				<div className="flex min-h-10 flex-wrap items-baseline gap-x-2 gap-y-1">
					{strikethrough && (
						<span className="text-2xl font-medium tracking-tight leading-none text-muted-foreground line-through">
							{strikethrough}
						</span>
					)}
					<span className="text-4xl font-medium tracking-tight leading-none text-foreground">
						{typeof display === "string" ? display : t(display)}
					</span>
					{note && (
						<span className="basis-full text-sm leading-none text-muted-foreground">
							{t(note)}
						</span>
					)}
				</div>
				{cadence && (
					<p className="text-xs text-muted-foreground">{i18n._(cadence)}</p>
				)}
				{tier.price.kind === "seat" && (
					<p className="mt-2 text-xs text-foreground">
						<Trans>Then {overagePrice} per GB-hour past the plan</Trans>
					</p>
				)}
			</div>

			<div className={cn("flex flex-col gap-2", wide && "md:max-w-xs")}>
				<Button asChild variant={tier.cta.variant} size="lg" className="w-full">
					{tier.cta.external ? (
						<a href={tier.cta.href} target="_blank" rel="noopener noreferrer">
							{t(tier.cta.label)}
						</a>
					) : tier.cta.event === "download_clicked" ? (
						<DownloadLink source="pricing" properties={{ tier: tier.id }}>
							{t(tier.cta.label)}
						</DownloadLink>
					) : (
						<TrackedLink
							href={
								tier.price.kind === "seat"
									? checkoutHref(
											env.NEXT_PUBLIC_WEB_URL,
											tier.price.plan,
											isYearly,
										)
									: tier.cta.href
							}
							event={tier.cta.event}
							properties={{
								source: "pricing",
								tier: tier.id,
								yearly: isYearly,
							}}
						>
							{t(tier.cta.label)}
						</TrackedLink>
					)}
				</Button>
				<CtaNote note={tier.ctaNote} />
			</div>

			<ul
				className={cn(
					"flex flex-col gap-3 border-t border-border pt-6",
					wide && "md:grid md:grid-cols-2 lg:grid-cols-3",
				)}
			>
				{tier.features.map((feature) => (
					<li
						key={feature.id}
						className="flex items-start gap-2.5 text-sm text-foreground"
					>
						<Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
						<span>{i18n._({ ...feature.label, values: featureValues })}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function CtaNote({ note }: { note: PricingTier["ctaNote"] }) {
	const { t } = useLingui();
	if (!note) {
		return <p className="h-4" aria-hidden="true" />;
	}
	if (note.href) {
		return (
			<a
				href={note.href}
				target="_blank"
				rel="noopener noreferrer"
				className="text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
			>
				{t(note.label)}
			</a>
		);
	}
	return (
		<p className="text-center text-xs text-muted-foreground">{t(note.label)}</p>
	);
}

function resolvePrice(
	tier: PricingTier,
	isYearly: boolean,
	values: PlanPriceValues,
): {
	display: string | MessageDescriptor;
	strikethrough: string | null;
	note: MessageDescriptor | null;
	cadence: MessageDescriptor | null;
} {
	if (tier.price.kind === "fixed" || tier.price.kind === "custom") {
		return {
			display: tier.price.display,
			strikethrough: null,
			note: null,
			cadence: tier.price.note,
		};
	}
	const { plan } = tier.price;
	return {
		...seatPrice(plan, values, isYearly),
		note: tier.price.note,
		cadence: {
			...(isYearly ? tier.price.yearlyCadence : tier.price.monthlyCadence),
			values: { yearlyTotal: values.plans[plan].yearlyTotal },
		},
	};
}
