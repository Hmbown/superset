import {
	type MachineSize,
	type PlanTier,
	planTierFromSubscription,
} from "@superset/shared/billing";
import { type CloudUsage, cloudUsageFromBalances } from "./cloud-usage";
import type { getAutumnCustomer } from "./customer";
import {
	gatedMachineSizesFromFlags,
	paidPlanIdFromFlags,
	tierFromFlags,
} from "./entitlements";
import { SEATS_FEATURE_ID } from "./features";

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
	status: "active" | "trialing" | "past_due" | null;
	cancelAt: string | null;
	periodStart: string | null;
	periodEnd: string | null;
	billingInterval: string | null;
	lapsed: boolean;
	paymentState: PaymentState;
	cloudUsage: CloudUsage | null;
	gatedMachineSizes: MachineSize[];
}

type AutumnCustomer = Awaited<ReturnType<typeof getAutumnCustomer>>;

export const FREE_BILLING: OrganizationBilling = {
	tier: "free",
	status: null,
	cancelAt: null,
	periodStart: null,
	periodEnd: null,
	billingInterval: null,
	lapsed: false,
	paymentState: { kind: "ok" },
	cloudUsage: null,
	gatedMachineSizes: [],
};

const UNPAID_INVOICE = new Set(["open", "uncollectible"]);

function iso(ms: number | null | undefined): string | null {
	return ms ? new Date(ms).toISOString() : null;
}

/**
 * The plan as the Stripe webhook projected it into `subscriptions`. Served
 * when an organization pays in Stripe but Autumn has no record of it, which
 * is what a missed import looks like; Autumn knows nothing about usage or
 * machine sizes for such an organization, so those read as none.
 */
export function billingFromSubscriptionRow(
	row:
		| {
				plan: string | null;
				status: string | null;
				cancelAt: Date | null;
				periodStart: Date | null;
				periodEnd: Date | null;
				billingInterval: string | null;
		  }
		| null
		| undefined,
): OrganizationBilling {
	const tier = planTierFromSubscription(row);
	if (!row || tier === "free") return FREE_BILLING;
	const status =
		row.status === "trialing" || row.status === "past_due"
			? row.status
			: "active";
	return {
		tier,
		status,
		cancelAt: row.cancelAt?.toISOString() ?? null,
		periodStart: row.periodStart?.toISOString() ?? null,
		periodEnd: row.periodEnd?.toISOString() ?? null,
		billingInterval: row.billingInterval,
		lapsed: false,
		paymentState:
			status === "past_due"
				? {
						kind: "past_due",
						amountDue: null,
						currency: null,
						hostedInvoiceUrl: null,
					}
				: { kind: "ok" },
		cloudUsage: null,
		gatedMachineSizes: [],
	};
}

export function billingFromCustomer(
	customer: Pick<
		AutumnCustomer,
		"flags" | "subscriptions" | "invoices" | "balances"
	>,
	now: number,
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
		status,
		cancelAt: iso(paid?.expiresAt),
		periodStart: iso(paid?.currentPeriodStart),
		periodEnd: iso(paid?.currentPeriodEnd),
		billingInterval:
			paid?.plan?.price?.interval ??
			paid?.plan?.items.find((item) => item.featureId === SEATS_FEATURE_ID)
				?.price?.interval ??
			null,
		lapsed,
		paymentState,
		cloudUsage: cloudUsageFromBalances(customer.balances),
		gatedMachineSizes: gatedMachineSizesFromFlags(customer.flags),
	};
}
