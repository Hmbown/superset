import { MAX_PRESENCE_VISITORS } from "@superset/shared/page-presence";
import { PresenceVisits } from "@superset/shared/presence-visits";
import { type Connection, type ConnectionContext, Server } from "partyserver";
import type { RealtimeEnv } from "./types";
import {
	broadcastPresence,
	SWEEP_MS,
	scheduleSweep,
	sweepSilent,
} from "./utils/presence";

interface Viewer {
	userId: string;
	name: string;
	image: string | null;
	observer: boolean;
	connectedAt: number;
}

export const WORKSPACE_CLAIMS_HEADER = "x-superset-workspace-claims";

/**
 * One object per cloud workspace: who is in it now and who has been. An
 * observer (the workspace's record view) sees both without counting as a
 * visit.
 */
export class WorkspaceHub extends Server<RealtimeEnv> {
	static options = { hibernate: true };

	private ready = false;
	private readonly visits: PresenceVisits;

	constructor(ctx: DurableObjectState, env: RealtimeEnv) {
		super(ctx, env);
		this.visits = new PresenceVisits(ctx.storage.sql);
		ctx.setWebSocketAutoResponse(
			new WebSocketRequestResponsePair("ping", "pong"),
		);
	}

	private schema(): void {
		if (this.ready) return;
		this.visits.ensureSchema();
		this.ready = true;
	}

	async onConnect(
		connection: Connection<Viewer>,
		ctx: ConnectionContext,
	): Promise<void> {
		this.schema();
		let claims: {
			userId?: unknown;
			name?: unknown;
			image?: unknown;
			observer?: unknown;
		};
		try {
			claims = JSON.parse(
				ctx.request.headers.get(WORKSPACE_CLAIMS_HEADER) ?? "",
			);
		} catch {
			connection.close(4401, "unauthorized");
			return;
		}
		if (typeof claims.userId !== "string" || typeof claims.name !== "string") {
			connection.close(4401, "unauthorized");
			return;
		}
		const now = Date.now();
		const viewer: Viewer = {
			userId: claims.userId,
			name: claims.name,
			image: typeof claims.image === "string" ? claims.image : null,
			observer: claims.observer === true,
			connectedAt: now,
		};
		connection.setState(viewer);
		if (!viewer.observer) {
			this.visits.record(
				{ userId: viewer.userId, name: viewer.name, image: viewer.image },
				now,
			);
		}
		this.announce();
		await scheduleSweep(this.ctx.storage, now);
	}

	async onClose(connection: Connection<Viewer>): Promise<void> {
		const viewer = connection.state;
		if (!viewer) return;
		this.schema();
		if (!viewer.observer) this.visits.touch(viewer.userId, Date.now());
		this.announce(connection.id);
	}

	async onAlarm(): Promise<void> {
		const now = Date.now();
		const { evicted, remaining } = sweepSilent(
			[...this.getConnections<Viewer>()].map((connection) => ({
				connection,
				connectedAt: connection.state?.connectedAt,
				heardAt: this.ctx.getWebSocketAutoResponseTimestamp(connection),
			})),
			now,
		);
		if (evicted) {
			this.schema();
			this.announce();
		}
		if (remaining > 0) await this.ctx.storage.setAlarm(now + SWEEP_MS);
	}

	/** Observers hear presence but are not part of it. */
	private announce(leaving?: string): void {
		const connections = [...this.getConnections<Viewer>()].filter(
			(connection) => connection.state && connection.id !== leaving,
		);
		broadcastPresence(
			connections.map((connection) => ({
				connection,
				userId: connection.state?.userId ?? "",
				seesVisitors: true,
			})),
			connections.flatMap((connection) => {
				const viewer = connection.state;
				if (!viewer || viewer.observer) return [];
				return [
					{
						userId: viewer.userId,
						viewer: {
							id: connection.id,
							key: viewer.userId,
							name: viewer.name,
							image: viewer.image,
							guest: false,
							guestNumber: null,
							color: 0,
						},
					},
				];
			}),
			this.visits.recent(MAX_PRESENCE_VISITORS),
		);
	}
}
