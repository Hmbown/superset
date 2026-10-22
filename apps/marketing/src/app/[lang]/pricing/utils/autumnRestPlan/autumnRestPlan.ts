import type { AutumnCatalogPlan } from "@superset/shared/billing";

export interface AutumnRestPlan {
	id: string;
	name: string;
	metadata?: Record<string, unknown> | null;
	items: Array<{
		feature_id: string;
		price?: {
			amount?: number | null;
			interval?: string | null;
			billing_units?: number | null;
		} | null;
	}>;
}

export function fromAutumnRest(plan: AutumnRestPlan): AutumnCatalogPlan {
	return {
		id: plan.id,
		name: plan.name,
		metadata: plan.metadata,
		items: plan.items.map((item) => ({
			featureId: item.feature_id,
			price: item.price
				? {
						amount: item.price.amount,
						interval: item.price.interval,
						billingUnits: item.price.billing_units,
					}
				: null,
		})),
	};
}
