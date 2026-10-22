"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { authClient } from "@superset/auth/client";
import {
	formatCurrency,
	formatDate,
	formatNumber,
} from "@superset/i18n/format";
import {
	isPaymentFailingStatus,
	PLAN_PRICE_CURRENCY,
	resolveCurrentPlan,
	SELF_SERVE_PLAN_IDS,
	type SelfServePlanId,
	seatPricePerMonth,
	selfServePlanFromAutumnPlanId,
} from "@superset/shared/billing";
import { COMPANY } from "@superset/shared/constants";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { Switch } from "@superset/ui/switch";
import { cn } from "@superset/ui/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "@/trpc/react";
import { CloudUsageCard } from "./components/CloudUsageCard";
import { useBillingActions } from "./hooks/useBillingActions";
import { usePlanCatalog } from "./hooks/usePlanCatalog";

interface BillingSettingsProps {
	/**
	 * The organization the caller wants billed, when it may differ from this
	 * session's active one: the mobile app links here with its own active
	 * organization, and the two sessions do not share that choice.
	 */
	organizationId?: string;
	selectedPlan?: SelfServePlanId;
	yearly?: boolean;
}

export function BillingSettings({
	organizationId,
	selectedPlan,
	yearly,
}: BillingSettingsProps) {
	const { t } = useLingui();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: session, isPending: sessionPending } = authClient.useSession();
	const [manualYearly, setIsYearly] = useState(yearly);

	const activeOrganizationId = session?.session?.activeOrganizationId;
	const switchingOrganization =
		!!session && !!organizationId && organizationId !== activeOrganizationId;
	const notMemberMessage = t({
		message: "You are not a member of that organization.",
	});

	useEffect(() => {
		if (!switchingOrganization) return;
		let cancelled = false;
		authClient.organization
			.setActive({ organizationId })
			.then(() => queryClient.invalidateQueries())
			.catch(() => {
				if (!cancelled) toast.error(notMemberMessage);
			});
		return () => {
			cancelled = true;
		};
	}, [switchingOrganization, organizationId, queryClient, notMemberMessage]);

	const { data: organizations } = useQuery(
		trpc.user.myOrganizations.queryOptions(),
	);
	const { data: members } = useQuery(
		trpc.organization.listMembers.queryOptions({ includeDeactivated: false }),
	);
	const { data: activePlan } = useQuery(trpc.billing.activePlan.queryOptions());
	const isYearly = manualYearly ?? activePlan?.billingInterval !== "month";

	const organization = organizations?.find(
		(candidate) => candidate.id === activeOrganizationId,
	);
	const currentMember = members?.find(
		(member) => member.userId === session?.user?.id,
	);
	const isOwner = currentMember?.role === "owner";
	// Seats are billed from this, so an unresolved list keeps checkout off.
	const memberCount =
		members && members.length > 0 ? members.length : undefined;

	const plan = resolveCurrentPlan({
		subscriptionPlan: activePlan?.plan,
		sessionPlan: session?.session?.plan,
		subscriptionsLoaded: activePlan !== undefined,
	});
	const cancelAt = activePlan?.cancelAt;
	const usesAutumn = activePlan?.billingProvider === "autumn";
	const selfServePlan =
		plan === "pro"
			? (selfServePlanFromAutumnPlanId(activePlan?.autumnPlanId) ?? "pro")
			: null;
	const catalog = usePlanCatalog({
		organizationId: activeOrganizationId,
		enabled: usesAutumn,
	});
	const offeredPlans: readonly SelfServePlanId[] = usesAutumn
		? SELF_SERVE_PLAN_IDS
		: ["pro"];
	const periodEnd = activePlan?.periodEnd;
	const isPaymentFailing = isPaymentFailingStatus(activePlan?.status);

	const invalidatePlan = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.billing.activePlan.queryKey(),
		});

	const {
		upgrade,
		cancel: handleCancel,
		restore: handleRestore,
		openPortal,
		isUpgrading,
		isCanceling,
		isRestoring,
		isOpeningPortal,
	} = useBillingActions({
		activeOrganizationId,
		activePlan,
		plan,
		invalidatePlan,
	});

	const handleUpgrade = async (target: SelfServePlanId) => {
		if (memberCount === undefined) return;
		await upgrade({
			plan: target,
			annual: isYearly,
			seats: memberCount,
		});
	};

	if (sessionPending || switchingOrganization || activePlan === undefined) {
		return (
			<p className="py-16 text-center text-sm text-muted-foreground">
				<Trans>Loading...</Trans>
			</p>
		);
	}

	const planNames: Record<SelfServePlanId, string> = {
		pro: t({ message: "Pro" }),
		team: t({ message: "Team", context: "plan name" }),
		ultra: t({ message: "Ultra", context: "plan name" }),
	};
	const planLabel = selfServePlan
		? planNames[selfServePlan]
		: {
				free: t({ message: "Free" }),
				pro: t({ message: "Pro" }),
				enterprise: t({ message: "Enterprise" }),
			}[plan];

	const planHint =
		plan === "enterprise"
			? t({ message: "Managed by your organization admin." })
			: cancelAt
				? t({
						message: `Cancels ${formatDate(cancelAt)} — downgrades to Free at the end of the billing period.`,
					})
				: plan === "pro" && periodEnd
					? t({ message: `Renews ${formatDate(periodEnd)}.` })
					: null;

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			<div>
				<h2 className="text-xl font-medium">
					<Trans>Billing</Trans>
				</h2>
				{organization && (
					<p className="mt-1 text-sm text-muted-foreground">
						{organization.name}
					</p>
				)}
			</div>

			{isPaymentFailing && (
				<div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						<Trans>
							Your last payment failed. Update your payment method to keep Pro.
						</Trans>
					</p>
					{isOwner && (
						<Button
							size="sm"
							variant="outline"
							className="shrink-0"
							disabled={isOpeningPortal}
							onClick={() => openPortal("payment_method_update")}
						>
							<Trans>Update payment method</Trans>
						</Button>
					)}
				</div>
			)}

			<div className="flex items-center justify-between gap-8 border-t pt-6">
				<div className="min-w-0">
					<div className="text-sm font-medium">
						<Trans>{planLabel} plan</Trans>
					</div>
					{planHint && (
						<div className="mt-1 text-sm text-muted-foreground">{planHint}</div>
					)}
				</div>
				{plan === "pro" && isOwner && (
					<div className="shrink-0">
						{cancelAt ? (
							<Button
								variant="outline"
								size="sm"
								onClick={handleRestore}
								disabled={isRestoring}
							>
								{isRestoring ? (
									<Trans>Restoring...</Trans>
								) : (
									<Trans>Restore plan</Trans>
								)}
							</Button>
						) : (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleCancel}
								disabled={isCanceling}
								className="text-muted-foreground hover:text-destructive"
							>
								{isCanceling ? (
									<Trans>Canceling...</Trans>
								) : (
									<Trans>Cancel plan</Trans>
								)}
							</Button>
						)}
					</div>
				)}
			</div>

			<CloudUsageCard />

			{(plan === "free" || (selfServePlan && usesAutumn && !cancelAt)) && (
				<div className="space-y-4 border-t pt-6">
					<div>
						<div className="text-sm font-medium">
							{plan === "free" ? (
								<Trans>Upgrade your plan</Trans>
							) : (
								<Trans>Change plan</Trans>
							)}
						</div>
						<div className="mt-1 text-sm text-muted-foreground">
							<Trans>
								Every paid plan includes Superset Mobile, cloud workspaces,
								automations, and priority support. Your team shares one pool of
								cloud GB-hours.
							</Trans>
						</div>
					</div>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Switch
							checked={isYearly}
							onCheckedChange={setIsYearly}
							aria-label={t({ message: "Billed yearly" })}
						/>
						{isYearly ? (
							<Trans>Billed yearly</Trans>
						) : (
							<Trans>Billed monthly</Trans>
						)}
					</div>
					<div className="divide-y rounded-md border">
						{offeredPlans.map((offeredPlan) => {
							const price = formatCurrency(
								seatPricePerMonth(offeredPlan, { annual: isYearly }, catalog),
								PLAN_PRICE_CURRENCY,
								{ minimumFractionDigits: 0 },
							);
							const gbHours = formatNumber(
								catalog[offeredPlan].gbMinutesPerSeat / 60,
							);
							const isCurrent =
								offeredPlan === selfServePlan &&
								isYearly === (activePlan?.billingInterval === "year");
							return (
								<div
									key={offeredPlan}
									className={cn(
										"flex items-center justify-between gap-4 p-4",
										offeredPlan === selectedPlan &&
											!isCurrent &&
											"bg-accent/40",
									)}
								>
									<div className="min-w-0">
										<div className="text-sm font-medium">
											{planNames[offeredPlan]}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											<Trans>
												{price} per user/month, {gbHours} cloud GB-hours per
												seat each month
											</Trans>
										</div>
									</div>
									{isOwner && (
										<Button
											size="sm"
											className="shrink-0"
											variant={isCurrent ? "secondary" : "default"}
											disabled={
												isCurrent || isUpgrading || memberCount === undefined
											}
											onClick={() => handleUpgrade(offeredPlan)}
										>
											{isCurrent ? (
												<Trans>Current plan</Trans>
											) : plan === "free" ? (
												<Trans>Upgrade</Trans>
											) : (
												<Trans>Switch plan</Trans>
											)}
										</Button>
									)}
								</div>
							);
						})}
					</div>
					{!isOwner && (
						<p className="text-sm text-muted-foreground">
							<Trans>
								Only an organization owner can change the plan. Ask yours to
								upgrade.
							</Trans>
						</p>
					)}
				</div>
			)}

			{plan === "pro" && isOwner && (
				<div className="flex items-center justify-between gap-8 border-t pt-6">
					<div>
						<div className="text-sm font-medium">
							<Trans>Invoices and payment method</Trans>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						className="shrink-0"
						disabled={isOpeningPortal}
						onClick={() => openPortal("general")}
					>
						<Trans>Manage billing</Trans>
					</Button>
				</div>
			)}

			<p className="border-t pt-6 text-sm text-muted-foreground">
				<Trans>
					For questions about billing,{" "}
					<a href={COMPANY.MAIL_TO} className="text-primary hover:underline">
						contact us
					</a>
					.
				</Trans>
			</p>
		</div>
	);
}
