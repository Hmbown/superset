import {
	isRealtimeSecret,
	loadWorkspaceAccess,
} from "@superset/trpc/lib/workspace-access";

/** Read by a workspace's realtime hub the first time someone connects to it. */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
	const { workspaceId } = await params;
	const presented = request.headers
		.get("authorization")
		?.replace(/^Bearer\s+/i, "");
	if (!presented || !isRealtimeSecret(presented)) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
		return Response.json({ error: "not found" }, { status: 404 });
	}
	const access = await loadWorkspaceAccess(workspaceId);
	if (!access) return Response.json({ error: "not found" }, { status: 404 });
	return Response.json(access);
}
