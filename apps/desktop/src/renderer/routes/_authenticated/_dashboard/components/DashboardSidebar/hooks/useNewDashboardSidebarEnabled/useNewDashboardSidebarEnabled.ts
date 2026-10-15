import { FEATURE_FLAGS } from "@superset/shared/constants";
import { useFeatureFlagEnabled } from "posthog-js/react";

/**
 * The new sidebar: cloud workspaces inline under their projects, the host
 * filter, and the redesigned workspace row. Needs cloud workspaces on too,
 * since the inline rows come from the cloud list.
 */
export function useNewDashboardSidebarEnabled(): boolean {
	const cloudWorkspaces = useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES);
	const inlineCloudWorkspaces = useFeatureFlagEnabled(
		FEATURE_FLAGS.SIDEBAR_INLINE_CLOUD_WORKSPACES,
	);
	return cloudWorkspaces === true && inlineCloudWorkspaces === true;
}
