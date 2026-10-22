import {
	type AutumnPlanSummary,
	SELF_SERVE_PLANS,
	type SelfServePlanCatalog,
	selfServePlansFromAutumn,
} from "@superset/shared/billing";
import { useQuery } from "@tanstack/react-query";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { useCurrentPlan } from "renderer/hooks/useCurrentPlan";
import { authClient } from "renderer/lib/auth-client";

const CATALOG_STALE_MS = 60 * 60 * 1000;

export function usePlanCatalog(): SelfServePlanCatalog {
	const organizationId = useActiveOrganizationId();
	const { activePlan } = useCurrentPlan();
	const { data } = useQuery({
		queryKey: ["billing", "autumnPlanCatalog", organizationId],
		enabled:
			activePlan?.billingProvider === "autumn" && Boolean(organizationId),
		staleTime: CATALOG_STALE_MS,
		queryFn: async () => {
			const { data: plans } = await authClient.$fetch<{
				list: AutumnPlanSummary[];
			}>("/autumn/listPlans", {
				method: "POST",
				body: { organizationId },
			});
			return plans ? selfServePlansFromAutumn(plans.list) : SELF_SERVE_PLANS;
		},
	});
	return data ?? SELF_SERVE_PLANS;
}
