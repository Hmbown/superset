import { useLingui } from "@lingui/react/macro";
import { usePresenceVisitors } from "@superset/ui/page-comments";
import { useNow } from "renderer/hooks/useNow";
import { authClient } from "renderer/lib/auth-client";
import { PresenceStack } from "renderer/routes/_authenticated/_dashboard/components/PresenceStack";

const NOW_TICK_MS = 30_000;

export function PagePresenceStack({ pageId }: { pageId: string | undefined }) {
	const { t } = useLingui();
	const now = useNow(NOW_TICK_MS);
	const { data: session } = authClient.useSession();
	const visitors = usePresenceVisitors(pageId);
	return (
		<PresenceStack
			people={visitors}
			viewerId={session?.user?.id}
			now={now}
			overflowLabel={t({ message: "Show everyone who opened this page" })}
		/>
	);
}
