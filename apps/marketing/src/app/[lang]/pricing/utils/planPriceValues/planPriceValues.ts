import { formatCurrency, formatNumber } from "@superset/i18n/format";
import {
	PLAN_PRICE_CURRENCY,
	SELF_SERVE_PLAN_IDS,
	type SelfServePlanId,
} from "@superset/shared/billing";
import type { PlanPrices } from "../planPricesFromAutumn";

export interface PlanPriceSet {
	monthly: string;
	yearly: string;
	yearlyTotal: string;
	gbHours: string;
	multiple: string;
	overage: string;
	hasYearlyDiscount: boolean;
}

export function cloudHourValues({ gbHours, multiple }: PlanPriceSet) {
	return { gbHours, multiple };
}

export type PlanPriceValues = {
	plans: Record<SelfServePlanId, PlanPriceSet>;
	monthlyPrice: string;
	yearlyPrice: string;
	teamPrice: string;
	teamYearlyPrice: string;
	ultraPrice: string;
	ultraYearlyPrice: string;
	proGbHours: string;
	teamGbHours: string;
	ultraGbHours: string;
	overagePrice: string;
	maxDiscount: string;
};

export function planPriceValues(
	prices: PlanPrices,
	locale: string,
): PlanPriceValues {
	const currency = (value: number) =>
		formatCurrency(
			value,
			PLAN_PRICE_CURRENCY,
			{ minimumFractionDigits: 0, maximumFractionDigits: 2 },
			locale,
		);
	const number = (value: number, digits: number) =>
		formatNumber(value, { maximumFractionDigits: digits }, locale);
	const plans = Object.fromEntries(
		SELF_SERVE_PLAN_IDS.map((id) => {
			const { monthly, yearly, gbMinutesPerSeat, overagePerGbHour } =
				prices[id];
			return [
				id,
				{
					monthly: currency(monthly),
					yearly: currency(yearly / 12),
					yearlyTotal: currency(yearly),
					gbHours: number(gbMinutesPerSeat / 60, 0),
					multiple: number(gbMinutesPerSeat / prices.pro.gbMinutesPerSeat, 1),
					overage: currency(overagePerGbHour),
					hasYearlyDiscount: yearly < monthly * 12,
				},
			];
		}),
	) as Record<SelfServePlanId, PlanPriceSet>;
	const maxDiscount = Math.max(
		...SELF_SERVE_PLAN_IDS.map(
			(id) => 1 - prices[id].yearly / (prices[id].monthly * 12),
		),
	);
	return {
		plans,
		monthlyPrice: plans.pro.monthly,
		yearlyPrice: plans.pro.yearly,
		teamPrice: plans.team.monthly,
		teamYearlyPrice: plans.team.yearly,
		ultraPrice: plans.ultra.monthly,
		ultraYearlyPrice: plans.ultra.yearly,
		proGbHours: plans.pro.gbHours,
		teamGbHours: plans.team.gbHours,
		ultraGbHours: plans.ultra.gbHours,
		overagePrice: currency(prices.pro.overagePerGbHour),
		maxDiscount: formatNumber(
			maxDiscount,
			{ style: "percent", maximumFractionDigits: 0 },
			locale,
		),
	};
}
