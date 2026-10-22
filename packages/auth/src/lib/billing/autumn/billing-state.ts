import {
	gbHourPack,
	type MachineSize,
	type PlanTier,
} from "@superset/shared/billing";
import { type CloudUsage, cloudUsageFromBalances } from "./cloud-usage";
import type { getAutumnCustomer } from "./customer";
import {
	gatedMachineSizesFromFlags,
	paidPlanIdFromFlags,
	tierFromFlags,
} from "./entitlements";
import {
	type EnvironmentLimit,
	environmentLimitFromBalances,
} from "./environment-limit";
import { SEATS_FEATURE_ID } from "./features";
import { seatRenewal } from "./seat-policy";

export type PaymentState =
	| { kind: "ok" }
	| {
			kind: "past_due";
			amountDue: number | null;
			currency: string | null;
			hostedInvoiceUrl: string | null;
	  }
	| { kind: "ended_unpaid"; amountDue: number | null; currency: string | null };

export interface OrganizationBilling {
	tier: PlanTier;
	autumnPlanId: string | null;
	status: "active" | "trialing" | "past_due" | null;
	cancelAt: string | null;
	periodStart: string | null;
	periodEnd: string | null;
	billingInterval: string | null;
	lapsed: boolean;
	paymentState: PaymentState;
	cloudUsage: CloudUsage | null;
	cloudAccess: boolean;
	gatedMachineSizes: MachineSize[];
	environmentLimit: EnvironmentLimit;
}

type AutumnCustomer = Awaited<ReturnType<typeof getAutumnCustomer>>;

const UNPAID_INVOICE = new Set(["open", "uncollectible"]);

/** Autumn plan metadata that turns on cloud workspaces for an organization on the plan. */
export const CLOUD_ACCESS_METADATA_KEY = "cloud_access";

function iso(ms: number | null | undefined): string | null {
	return ms ? new Date(ms).toISOString() : null;
}

export function billingFromCustomer(
	customer: Pick<
		AutumnCustomer,
		"flags" | "subscriptions" | "invoices" | "balances" | "billingControls"
	>,
	now: number,
	seatInterval: string | null = null,
): OrganizationBilling {
	const tier = tierFromFlags(customer.flags);
	const paidPlanId = paidPlanIdFromFlags(customer.flags);
	const paid = paidPlanId
		? customer.subscriptions.find(
				(subscription) => subscription.planId === paidPlanId,
			)
		: undefined;
	const unpaidInvoice = (customer.invoices ?? [])
		.filter((invoice) => UNPAID_INVOICE.has(invoice.status))
		.sort((a, b) => b.createdAt - a.createdAt)[0];
	const status = !paid
		? tier === "free"
			? null
			: "active"
		: paid.pastDue
			? "past_due"
			: paid.trialEndsAt && paid.trialEndsAt > now
				? "trialing"
				: "active";
	const lapsed = tier === "free" && unpaidInvoice !== undefined;
	const paymentState: PaymentState =
		status === "past_due"
			? {
					kind: "past_due",
					amountDue: unpaidInvoice?.total ?? null,
					currency: unpaidInvoice?.currency ?? null,
					hostedInvoiceUrl: unpaidInvoice?.hostedInvoiceUrl ?? null,
				}
			: lapsed
				? {
						kind: "ended_unpaid",
						amountDue: unpaidInvoice?.total ?? null,
						currency: unpaidInvoice?.currency ?? null,
					}
				: { kind: "ok" };
	return {
		tier,
		autumnPlanId: paidPlanId,
		status,
		cancelAt: iso(paid?.expiresAt),
		periodStart: iso(paid?.currentPeriodStart),
		periodEnd: iso(
			seatRenewal({
				startedAt: paid?.startedAt,
				currentPeriodEnd: paid?.currentPeriodEnd,
				seatInterval,
				now,
			}),
		),
		billingInterval:
			paid?.plan?.price?.interval ??
			paid?.plan?.items.find((item) => item.featureId === SEATS_FEATURE_ID)
				?.price?.interval ??
			seatInterval,
		lapsed,
		paymentState,
		cloudUsage: cloudUsageFromBalances(
			customer.balances,
			customer.billingControls,
			paid?.plan ? gbHourPack(paid.plan) : null,
		),
		cloudAccess: paid?.plan?.metadata?.[CLOUD_ACCESS_METADATA_KEY] === true,
		gatedMachineSizes: gatedMachineSizesFromFlags(customer.flags),
		environmentLimit:
			environmentLimitFromBalances(customer.balances) ??
			(tier === "free" ? 0 : null),
	};
}
