import { useWorkspaceClient } from "@superset/workspace-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWorkspaceEvent } from "renderer/hooks/host-service/useWorkspaceEvent";
import { useChatWiring } from "../usePaneRegistry/components/ChatSession/hooks/useSessionClient";

export function useWorkspaceChatSessions(
	workspaceId: string,
	enabled: boolean,
) {
	const { hostUrl } = useWorkspaceClient();
	const { transport } = useChatWiring();
	const queryClient = useQueryClient();
	const queryKey = useMemo(
		() => ["chat-v3", hostUrl, "listSessions", workspaceId],
		[hostUrl, workspaceId],
	);
	const query = useQuery({
		queryKey,
		queryFn: () => transport.listSessions({ workspaceId }),
		enabled,
		refetchOnWindowFocus: false,
	});

	useWorkspaceEvent(
		"chat:sessions-changed",
		workspaceId,
		() => {
			void queryClient.invalidateQueries({ queryKey });
		},
		enabled,
	);

	return query;
}
