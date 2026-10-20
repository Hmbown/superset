import {
	MAX_PRESENCE_VISITORS,
	type PagePresenceViewer,
	type PresenceVisitor,
} from "@superset/shared/page-presence";
import {
	canOpenWorkspace,
	parseWorkspaceAccess,
	type WorkspaceAccess,
	type WorkspaceActor,
} from "@superset/shared/workspace-access";
import { type Connection, type ConnectionContext, Server } from "partyserver";
import type { RealtimeEnv } from "./types";

interface Viewer extends WorkspaceActor {
	name: string;
	image: string | null;
	observer: boolean;
	connectedAt: number;
}

interface StoredAccess {
	access: WorkspaceAccess | null;
	readAt: number;
}

export const WORKSPACE_CLAIMS_HEADER = "x-superset-workspace-claims";

const SWEEP_MS = 30_000;
const SILENT_MS = 75_000;
/** A missed push from the API heals within this. */
const ACCESS_TTL_MS = 60 * 60_000;
/** A refusal re-reads access at most this often, so a new share works at once. */
const ACCESS_RETRY_MS = 60_000;

/**
 * One object per cloud workspace: who is in it now and who has been. An
 * observer (the workspace's record view) sees both without counting as a
 * visit.
 */
export class WorkspaceHub extends Server<RealtimeEnv> {
	static options = { hibernate: true };

	private ready = false;
	private access: StoredAccess | undefined;

	constructor(ctx: DurableObjectState, env: RealtimeEnv) {
		super(ctx, env);
		ctx.setWebSocketAutoResponse(
			new WebSocketRequestResponsePair("ping", "pong"),
		);
	}

	private schema(): void {
		if (this.ready) return;
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS visits (
				user_id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				image TEXT,
				first_seen_at INTEGER NOT NULL,
				last_seen_at INTEGER NOT NULL
			)`,
		);
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
			organizationIds?: unknown;
			teamIds?: unknown;
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
		if (
			typeof claims.userId !== "string" ||
			typeof claims.name !== "string" ||
			!Array.isArray(claims.organizationIds) ||
			!Array.isArray(claims.teamIds)
		) {
			connection.close(4401, "unauthorized");
			return;
		}
		const viewer: Viewer = {
			userId: claims.userId,
			name: claims.name,
			image: typeof claims.image === "string" ? claims.image : null,
			organizationIds: claims.organizationIds,
			teamIds: claims.teamIds,
			observer: claims.observer === true,
			connectedAt: Date.now(),
		};
		let access: WorkspaceAccess | null;
		try {
			access = await this.admit(viewer);
		} catch {
			connection.close(1013, "unavailable");
			return;
		}
		if (!access) {
			connection.close(4403, "Not found");
			return;
		}
		const now = Date.now();
		connection.setState(viewer);
		if (!viewer.observer) {
			this.ctx.storage.sql.exec(
				`INSERT INTO visits (user_id, name, image, first_seen_at, last_seen_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (user_id) DO UPDATE SET
					name = excluded.name,
					image = excluded.image,
					last_seen_at = excluded.last_seen_at`,
				viewer.userId,
				viewer.name,
				viewer.image,
				now,
				now,
			);
		}
		this.announce();
		if ((await this.ctx.storage.getAlarm()) === null) {
			await this.ctx.storage.setAlarm(now + SWEEP_MS);
		}
	}

	/** Called by the API when visibility or sharing changes. */
	async accessChanged(access: WorkspaceAccess | null): Promise<void> {
		await this.storeAccess(access);
		let removed = false;
		for (const connection of this.getConnections<Viewer>()) {
			const viewer = connection.state;
			if (viewer && (!access || !canOpenWorkspace(access, viewer))) {
				try {
					connection.close(4403, "Not found");
				} catch {}
				removed = true;
			}
		}
		if (removed) {
			this.schema();
			this.announce();
		}
	}

	private async admit(viewer: Viewer): Promise<WorkspaceAccess | null> {
		const stored = await this.readStoredAccess();
		const age = stored ? Date.now() - stored.readAt : Number.POSITIVE_INFINITY;
		if (stored && age < ACCESS_TTL_MS) {
			if (stored.access && canOpenWorkspace(stored.access, viewer)) {
				return stored.access;
			}
			if (age < ACCESS_RETRY_MS) return null;
		}
		const access = await this.fetchAccess();
		await this.storeAccess(access);
		return access && canOpenWorkspace(access, viewer) ? access : null;
	}

	private async readStoredAccess(): Promise<StoredAccess | undefined> {
		this.access ??= await this.ctx.storage.get<StoredAccess>("access");
		return this.access;
	}

	private async storeAccess(access: WorkspaceAccess | null): Promise<void> {
		this.access = { access, readAt: Date.now() };
		await this.ctx.storage.put("access", this.access);
	}

	private async fetchAccess(): Promise<WorkspaceAccess | null> {
		const [organizationId, workspaceId] = this.name.split(":");
		const response = await fetch(
			`${this.env.NEXT_PUBLIC_API_URL}/api/cloud-workspaces/${workspaceId}/realtime-access`,
			{
				headers: { authorization: `Bearer ${this.env.NUDGE_SECRET}` },
				signal: AbortSignal.timeout(5_000),
			},
		);
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`access lookup: ${response.status}`);
		const access = parseWorkspaceAccess(await response.json());
		return access?.organizationId === organizationId ? access : null;
	}

	async onClose(connection: Connection<Viewer>): Promise<void> {
		const viewer = connection.state;
		if (!viewer) return;
		this.schema();
		if (!viewer.observer) {
			this.ctx.storage.sql.exec(
				"UPDATE visits SET last_seen_at = ? WHERE user_id = ?",
				Date.now(),
				viewer.userId,
			);
		}
		this.announce(connection.id);
	}

	async onAlarm(): Promise<void> {
		const now = Date.now();
		let remaining = 0;
		let evicted = false;
		for (const connection of this.getConnections<Viewer>()) {
			const heardAt =
				this.ctx.getWebSocketAutoResponseTimestamp(connection)?.getTime() ??
				connection.state?.connectedAt;
			if (heardAt && now - heardAt > SILENT_MS) {
				try {
					connection.close(4408, "silent");
				} catch {}
				evicted = true;
				continue;
			}
			remaining++;
		}
		if (evicted) {
			this.schema();
			this.announce();
		}
		if (remaining > 0) await this.ctx.storage.setAlarm(now + SWEEP_MS);
	}

	private announce(leaving?: string): void {
		const connections = [...this.getConnections<Viewer>()].filter(
			(connection) => connection.state && connection.id !== leaving,
		);
		const present = connections.filter(
			(connection) => connection.state?.observer === false,
		);
		const here = new Set(present.map((connection) => connection.state?.userId));
		const visitors: PresenceVisitor[] = this.ctx.storage.sql
			.exec<{
				user_id: string;
				name: string;
				image: string | null;
				last_seen_at: number;
			}>(
				"SELECT user_id, name, image, last_seen_at FROM visits ORDER BY last_seen_at DESC LIMIT ?",
				MAX_PRESENCE_VISITORS,
			)
			.toArray()
			.map((row) => ({
				userId: row.user_id,
				name: row.name,
				image: row.image,
				lastSeenAt: row.last_seen_at,
				active: here.has(row.user_id),
			}));
		for (const connection of connections) {
			const userId = connection.state?.userId;
			const viewers: PagePresenceViewer[] = present
				.filter((other) => other.state?.userId !== userId)
				.map((other) => ({
					id: other.id,
					key: other.state?.userId ?? other.id,
					name: other.state?.name ?? "",
					image: other.state?.image ?? null,
					guest: false,
					guestNumber: null,
					color: 0,
				}));
			try {
				connection.send(
					JSON.stringify({ type: "presence", viewers, visitors }),
				);
			} catch {}
		}
	}
}
