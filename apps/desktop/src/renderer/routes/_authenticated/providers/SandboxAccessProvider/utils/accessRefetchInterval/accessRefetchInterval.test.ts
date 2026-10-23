import { describe, expect, test } from "bun:test";
import {
	ACCESS_RETRY_MS,
	accessRefetchInterval,
	MAX_ERROR_RETRY_MS,
} from "./accessRefetchInterval";

const NOW = 1_000_000;

describe("accessRefetchInterval", () => {
	test("retries soon before the first ticket arrives", () => {
		expect(accessRefetchInterval({}, NOW)).toBe(ACCESS_RETRY_MS);
	});

	test("re-mints at 80% of a ticket's remaining life", () => {
		const expiresAt = NOW + 60 * 60 * 1000;
		expect(accessRefetchInterval({ data: { expiresAt } }, NOW)).toBe(
			48 * 60 * 1000,
		);
	});

	test.each([
		"FORBIDDEN",
		"INTERNAL_SERVER_ERROR",
	])("a %s retries soon, then backs off to the cap", (code) => {
		const error = { data: { code } };
		const after = (errorUpdateCount: number) =>
			accessRefetchInterval({ error, errorUpdateCount }, NOW);
		expect(after(1)).toBe(ACCESS_RETRY_MS);
		expect(after(3)).toBe(4 * ACCESS_RETRY_MS);
		expect(after(50)).toBe(MAX_ERROR_RETRY_MS);
	});
});
