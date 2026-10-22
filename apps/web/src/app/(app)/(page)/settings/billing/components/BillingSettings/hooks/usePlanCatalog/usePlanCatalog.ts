"use client";

import { authClient } from "@superset/auth/client";
import {
	type AutumnPlanSummary,
	SELF_SERVE_PLANS,
	type SelfServePlanCatalog,
	selfServePlansFromAutumn,
} from "@superset/shared/billing";
import { useQuery } from "@tanstack/react-query";

const CATALOG_STALE_MS = 60 * 60 * 1000;

export function usePlanCatalog({
	organizationId,
	enabled,
}: {
	organizationId: string | null | undefined;
	enabled: boolean;
}): SelfServePlanCatalog {
	const { data } = useQuery({
		queryKey: ["billing", "autumnPlanCatalog", organizationId],
		enabled: enabled && Boolean(organizationId),
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
