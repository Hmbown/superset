import type { SelfServePlanId } from "@superset/shared/billing";
import type { ComparisonRow, ComparisonValue, TierId } from "../../constants";
import type { PlanPriceValues } from "../planPriceValues";

export function seatPrice(
	plan: SelfServePlanId,
	values: PlanPriceValues,
	yearly: boolean,
): { display: string; strikethrough: string | null } {
	const prices = values.plans[plan];
	if (!yearly) return { display: prices.monthly, strikethrough: null };
	return {
		display: prices.yearly,
		strikethrough: prices.hasYearlyDiscount ? prices.monthly : null,
	};
}

export function comparisonValue(
	row: ComparisonRow,
	tier: TierId,
	values: PlanPriceValues,
): ComparisonValue | null {
	if (tier === "free") return row.values[0];
	if (tier === "enterprise") return row.values[2];
	return row.cloudGbHours ? values.plans[tier].gbHours : row.values[1];
}
