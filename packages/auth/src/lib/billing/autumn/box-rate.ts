export const BOX_RATE_METADATA_KEY = "box_rate";

type Metadata = Record<string, unknown> | null | undefined;

function rateIn(metadata: Metadata): number | null {
	const value = Number(metadata?.[BOX_RATE_METADATA_KEY]);
	return Number.isFinite(value) && value > 0 ? value : null;
}

export function boxRateFrom({
	customer,
	plan,
}: {
	customer: Metadata;
	plan: Metadata;
}): number {
	return rateIn(customer) ?? rateIn(plan) ?? 1;
}
