import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
	REFRESH_REUSE_GRACE_MS,
	rejectRecentlyRotatedRefreshToken,
} from "./refresh-token-reuse-grace";

const NOW = 1_800_000_000_000;

function tokenRequest(revoked: Date | null | undefined, token = "rt") {
	const lookups: string[] = [];
	return {
		lookups,
		ctx: {
			path: "/oauth2/token",
			body: { grant_type: "refresh_token", refresh_token: token },
			context: {
				adapter: {
					findOne: async <T>(query: {
						where: { field: string; value: string }[];
					}) => {
						lookups.push(query.where[0]?.value ?? "");
						return (revoked === undefined ? null : { revoked }) as T | null;
					},
				},
			},
		},
	};
}

describe("rejectRecentlyRotatedRefreshToken", () => {
	it("rejects a token rotated inside the grace window before the provider sees it", async () => {
		const { ctx, lookups } = tokenRequest(new Date(NOW - 1000));
		await expect(
			rejectRecentlyRotatedRefreshToken(ctx, NOW),
		).rejects.toMatchObject({ body: { error: "invalid_grant" } });
		expect(lookups).toEqual([
			createHash("sha256").update("rt").digest("base64url"),
		]);
	});

	it("lets the provider handle a token rotated before the window, a live token, or an unknown one", async () => {
		for (const revoked of [
			new Date(NOW - REFRESH_REUSE_GRACE_MS),
			null,
			undefined,
		]) {
			const { ctx } = tokenRequest(revoked);
			await expect(
				rejectRecentlyRotatedRefreshToken(ctx, NOW),
			).resolves.toBeUndefined();
		}
	});

	it("ignores other paths and grants", async () => {
		const { ctx, lookups } = tokenRequest(new Date(NOW));
		await rejectRecentlyRotatedRefreshToken(
			{ ...ctx, path: "/oauth2/introspect" },
			NOW,
		);
		await rejectRecentlyRotatedRefreshToken(
			{ ...ctx, body: { grant_type: "authorization_code", code: "c" } },
			NOW,
		);
		expect(lookups).toEqual([]);
	});
});
