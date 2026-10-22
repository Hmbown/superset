import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import {
	formatCurrency,
	formatList,
	formatNumber,
} from "@superset/i18n/format";
import {
	maxYearlyDiscount,
	offersYearlyDiscount,
	PLAN_PRICE_CURRENCY,
	type PlanFamily,
	seatPricePerMonth,
} from "@superset/shared/billing";

export interface FamilyPriceSet {
	family: string;
	name: string;
	monthly: string;
	yearly: string;
	yearlyTotal: string | null;
	hasYearlyDiscount: boolean;
	gbHours: string | null;
	multiple: string | null;
	overage: string | null;
	previousName: string | null;
	baseName: string;
}

export interface PlanPriceValues {
	families: FamilyPriceSet[];
	byFamily: Record<string, FamilyPriceSet>;
	maxDiscount: string | null;
	fromPrice: string | null;
	planPrices: string;
	allowances: string;
	overagePrice: string | null;
}

const YEARLY_PRICE_ITEM = msg({
	message: "{name}: {monthly} per user/month, or {yearly} billed yearly",
});
const MONTHLY_PRICE_ITEM = msg({
	message: "{name}: {monthly} per user/month",
});
const ALLOWANCE_ITEM = msg({ message: "{gbHours} on {name}" });

export function planPriceValues(
	catalog: PlanFamily[],
	i18n: I18n,
): PlanPriceValues {
	const locale = i18n.locale;
	const currency = (value: number) =>
		formatCurrency(
			value,
			PLAN_PRICE_CURRENCY,
			{ minimumFractionDigits: 0, maximumFractionDigits: 2 },
			locale,
		);
	const number = (value: number, digits: number) =>
		formatNumber(value, { maximumFractionDigits: digits }, locale);
	const base = catalog[0];
	const families = catalog.map((family, index): FamilyPriceSet => {
		const hasYearlyDiscount = offersYearlyDiscount(family);
		return {
			family: family.family,
			name: family.name,
			monthly: currency(seatPricePerMonth(family, false)),
			yearly: currency(seatPricePerMonth(family, true)),
			yearlyTotal:
				hasYearlyDiscount && family.yearly
					? currency(family.yearly.seatPrice)
					: null,
			hasYearlyDiscount,
			gbHours: family.gbMinutesPerSeat
				? number(family.gbMinutesPerSeat / 60, 0)
				: null,
			multiple:
				family.gbMinutesPerSeat && base?.gbMinutesPerSeat
					? number(family.gbMinutesPerSeat / base.gbMinutesPerSeat, 1)
					: null,
			overage:
				family.overagePerGbHour == null
					? null
					: currency(family.overagePerGbHour),
			previousName: catalog[index - 1]?.name ?? null,
			baseName: base?.name ?? family.name,
		};
	});
	const discount = maxYearlyDiscount(catalog);
	const cheapest = Math.min(
		...catalog.map((family) => seatPricePerMonth(family, true)),
	);
	return {
		families,
		byFamily: Object.fromEntries(families.map((set) => [set.family, set])),
		maxDiscount:
			discount > 0
				? formatNumber(
						discount,
						{ style: "percent", maximumFractionDigits: 0 },
						locale,
					)
				: null,
		fromPrice: Number.isFinite(cheapest) ? currency(cheapest) : null,
		planPrices: formatList(
			families.map((set) =>
				i18n._({
					...(set.hasYearlyDiscount ? YEARLY_PRICE_ITEM : MONTHLY_PRICE_ITEM),
					values: { name: set.name, monthly: set.monthly, yearly: set.yearly },
				}),
			),
			{ type: "conjunction" },
			locale,
		),
		allowances: formatList(
			families
				.filter((set) => set.gbHours)
				.map((set) =>
					i18n._({
						...ALLOWANCE_ITEM,
						values: { gbHours: set.gbHours, name: set.name },
					}),
				),
			{ type: "conjunction" },
			locale,
		),
		overagePrice: families[0]?.overage ?? null,
	};
}

export function featureValues(set: FamilyPriceSet | undefined) {
	return {
		gbHours: set?.gbHours ?? "",
		multiple: set?.multiple ?? "",
		previousPlan: set?.previousName ?? "",
		basePlan: set?.baseName ?? "",
	};
}
