import type { SelfServePlanId } from "@superset/shared/billing";

export function checkoutHref(
	webUrl: string,
	plan: SelfServePlanId,
	yearly: boolean,
): string {
	const url = new URL("/settings/billing", webUrl);
	url.searchParams.set("plan", plan);
	url.searchParams.set("interval", yearly ? "yearly" : "monthly");
	return url.toString();
}
