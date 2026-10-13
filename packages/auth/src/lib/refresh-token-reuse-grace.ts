import { createHash } from "node:crypto";
import { APIError } from "better-auth/api";

/**
 * `@better-auth/oauth-provider` deletes every token a user holds for a client
 * when a rotated refresh token is sent again. Clients that refresh from
 * several processes at once (the CLI, GH #8426), or retry a refresh whose
 * response they lost, send one again within seconds. Inside this window the
 * reuse is rejected without that deletion; later reuse still triggers it.
 */
export const REFRESH_REUSE_GRACE_MS = 10 * 60 * 1000;

type TokenRequestContext = {
	path: string;
	body?: unknown;
	context: {
		adapter: {
			findOne: <T>(query: {
				model: string;
				where: { field: string; value: string }[];
			}) => Promise<T | null>;
		};
	};
};

export async function rejectRecentlyRotatedRefreshToken(
	ctx: TokenRequestContext,
	now = Date.now(),
): Promise<void> {
	if (ctx.path !== "/oauth2/token") return;
	const body = ctx.body as
		| { grant_type?: unknown; refresh_token?: unknown }
		| undefined;
	if (body?.grant_type !== "refresh_token") return;
	if (typeof body.refresh_token !== "string" || !body.refresh_token) return;

	const row = await ctx.context.adapter.findOne<{ revoked?: Date | null }>({
		model: "oauthRefreshToken",
		where: [{ field: "token", value: hashRefreshToken(body.refresh_token) }],
	});
	if (!row?.revoked) return;
	if (now - new Date(row.revoked).getTime() >= REFRESH_REUSE_GRACE_MS) return;

	throw new APIError("BAD_REQUEST", {
		error: "invalid_grant",
		error_description: "invalid refresh token",
	});
}

/** Matches the provider's default `storeTokens: "hashed"`. */
function hashRefreshToken(token: string): string {
	return createHash("sha256").update(token).digest("base64url");
}
