import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { join } from "node:path";
import { refreshAccessToken, TokenRefreshHttpError } from "./auth";
import {
	AUTH_REFRESH_LEEWAY_MS,
	readConfig,
	type SupersetConfig,
	writeConfig,
} from "./config";
import { getSupersetHomeDir } from "./settings/paths";

/**
 * The token endpoint rotates the refresh token on every call. Sending a
 * rotated token again is treated as theft and revokes every token the user
 * holds for this client (GH #8426), unless it comes within the server's reuse
 * grace window (REFRESH_REUSE_GRACE_MS in packages/auth). So the machine
 * refreshes as one client: one process at a time, under a lock, and a
 * refresh whose outcome is unknown is retried only inside that window.
 */
export interface RefreshDeps {
	refresh: (refreshToken: string) => Promise<{
		accessToken: string;
		refreshToken?: string;
		expiresAt: number;
	}>;
	readConfig: () => SupersetConfig;
	writeConfig: (config: SupersetConfig) => void;
	lockPath: string;
	/** A lock not touched for this long belongs to a dead process. */
	lockStaleMs: number;
	lockHeartbeatMs: number;
	/** How long to wait for a live holder before giving up on this command. */
	lockTimeoutMs: number;
	pollMs: number;
	/** How long after an unknown outcome the stored token may still be sent. Must stay below the server's grace window. */
	retryWindowMs: number;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
}

function defaultRefreshDeps(): RefreshDeps {
	return {
		refresh: refreshAccessToken,
		readConfig,
		writeConfig,
		lockPath: join(getSupersetHomeDir(), "auth-refresh.lock"),
		lockStaleMs: 5_000,
		lockHeartbeatMs: 1_000,
		lockTimeoutMs: 75_000,
		pollMs: 25,
		retryWindowMs: 5 * 60 * 1000,
		now: () => Date.now(),
		sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	};
}

export class RefreshInProgressError extends Error {
	constructor() {
		super("session refresh still in progress elsewhere");
	}
}

export class SessionExpiredError extends Error {
	constructor() {
		super("session expired");
	}
}

export class ServerUnreachableError extends Error {
	constructor(cause: unknown) {
		super("could not reach the server", { cause });
	}
}

export function isAuthFresh(auth: StoredAuth, now: number): boolean {
	return auth.expiresAt - AUTH_REFRESH_LEEWAY_MS > now;
}

/**
 * Renews the stored OAuth tokens, coordinating with every other CLI process
 * on this machine. Returns the config holding a usable access token.
 */
export async function refreshStoredAuth(
	deps: RefreshDeps = defaultRefreshDeps(),
): Promise<AuthedConfig> {
	const lock = await acquireLock(deps);
	try {
		const latest = deps.readConfig();
		const auth = latest.auth;
		if (hasFreshAuth(latest, deps.now())) return latest;
		if (!auth?.refreshToken) throw new SessionExpiredError();
		if (lock.state === "timed-out") throw new RefreshInProgressError();

		const dropRefreshToken = () => {
			deps.writeConfig(
				withAuth(latest, {
					...auth,
					refreshToken: undefined,
					refreshStartedAt: undefined,
				}),
			);
			return new SessionExpiredError();
		};

		const startedAt = auth.refreshStartedAt ?? deps.now();
		if (deps.now() - startedAt > deps.retryWindowMs) throw dropRefreshToken();
		deps.writeConfig(
			withAuth(latest, { ...auth, refreshStartedAt: startedAt }),
		);

		let refreshed: Awaited<ReturnType<RefreshDeps["refresh"]>>;
		try {
			refreshed = await deps.refresh(auth.refreshToken);
		} catch (error) {
			const current = deps.readConfig();
			if (hasFreshAuth(current, deps.now())) return current;
			switch (classifyFailure(error)) {
				case "unsent":
					deps.writeConfig(latest);
					throw new ServerUnreachableError(error);
				case "rejected":
					throw dropRefreshToken();
				case "unknown":
					throw error;
			}
		}

		const current = deps.readConfig();
		if (
			current.auth?.refreshToken !== auth.refreshToken &&
			hasFreshAuth(current, deps.now())
		) {
			return current;
		}
		const next = withAuth(current, {
			accessToken: refreshed.accessToken,
			refreshToken: refreshed.refreshToken,
			expiresAt: refreshed.expiresAt,
		});
		deps.writeConfig(next);
		return next;
	} finally {
		lock.release();
	}
}

type StoredAuth = NonNullable<SupersetConfig["auth"]>;
type AuthedConfig = SupersetConfig & { auth: StoredAuth };

function hasFreshAuth(
	config: SupersetConfig,
	now: number,
): config is AuthedConfig {
	return config.auth !== undefined && isAuthFresh(config.auth, now);
}

function withAuth(config: SupersetConfig, auth: StoredAuth): AuthedConfig {
	return { ...config, auth };
}

const UNSENT_ERROR_CODES = new Set([
	"ConnectionRefused",
	"ECONNREFUSED",
	"ENOTFOUND",
	"EAI_AGAIN",
]);

function classifyFailure(error: unknown): "unsent" | "rejected" | "unknown" {
	if (error instanceof TokenRefreshHttpError) {
		if (error.status === 400 || error.status === 401) return "rejected";
		if (error.status === 429) return "unsent";
		return "unknown";
	}
	const { code, cause } = error as {
		code?: unknown;
		cause?: { code?: unknown };
	};
	if (
		UNSENT_ERROR_CODES.has(String(code)) ||
		UNSENT_ERROR_CODES.has(String(cause?.code))
	) {
		return "unsent";
	}
	return "unknown";
}

/**
 * Exclusive-create lock file holding an ownership token. The holder touches
 * it every `lockHeartbeatMs`, so a lock left untouched for `lockStaleMs`
 * belongs to a dead process however long a live refresh takes. Release and
 * takeover check the token, so a lock that changed hands is never removed.
 */
type AcquiredLock = {
	/** "unlockable": the filesystem refuses locks, so no process can hold one. */
	state: "held" | "unlockable" | "timed-out";
	release: () => void;
};

async function acquireLock(deps: RefreshDeps): Promise<AcquiredLock> {
	const token = `${process.pid} ${randomUUID()}`;
	const deadline = deps.now() + deps.lockTimeoutMs;
	const ownsLock = () => {
		try {
			return fs.readFileSync(deps.lockPath, "utf-8") === token;
		} catch {
			return false;
		}
	};
	for (;;) {
		try {
			const fd = fs.openSync(deps.lockPath, "wx");
			fs.writeSync(fd, token);
			fs.closeSync(fd);
			const heartbeat = setInterval(() => {
				if (!ownsLock()) return;
				try {
					const now = new Date();
					fs.utimesSync(deps.lockPath, now, now);
				} catch {}
			}, deps.lockHeartbeatMs);
			heartbeat.unref?.();
			return {
				state: "held",
				release: () => {
					clearInterval(heartbeat);
					try {
						if (ownsLock()) fs.unlinkSync(deps.lockPath);
					} catch {}
				},
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
				return { state: "unlockable", release: () => {} };
			}
		}
		if (deps.now() >= deadline) {
			return { state: "timed-out", release: () => {} };
		}
		try {
			const observed = fs.readFileSync(deps.lockPath, "utf-8");
			const age = Date.now() - fs.statSync(deps.lockPath).mtimeMs;
			if (age > deps.lockStaleMs) {
				const corpse = `${deps.lockPath}.${randomUUID()}.stale`;
				fs.renameSync(deps.lockPath, corpse);
				if (fs.readFileSync(corpse, "utf-8") === observed) {
					fs.unlinkSync(corpse);
					continue;
				}
				// Changed hands between the read and the rename: give it back.
				// A hard link cannot replace a lock created at the path since.
				try {
					fs.linkSync(corpse, deps.lockPath);
				} catch {}
				try {
					fs.unlinkSync(corpse);
				} catch {}
			}
		} catch {}
		await deps.sleep(deps.pollMs);
	}
}
