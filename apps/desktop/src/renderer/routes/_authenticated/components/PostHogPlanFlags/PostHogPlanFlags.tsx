import { useEffect } from "react";
import { useCurrentPlan } from "renderer/hooks/useCurrentPlan";
import { posthog } from "renderer/lib/posthog";

export function PostHogPlanFlags() {
	const { activePlan } = useCurrentPlan();
	const cloudAccess = activePlan?.cloudAccess;

	useEffect(() => {
		if (cloudAccess === undefined) return;
		posthog.setPersonPropertiesForFlags({
			plan_cloud_access: String(cloudAccess),
		});
	}, [cloudAccess]);

	return null;
}
