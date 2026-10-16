import { describe, expect, it } from "bun:test";
import type { McpServerEntry } from "@superset/shared/mcp-servers";
import { type McpPluginAccount, mcpPickerRows } from "./mcpPickerRows";

function server(overrides: Partial<McpServerEntry>): McpServerEntry {
	return {
		name: "docs",
		agent: "claude",
		scope: "user",
		transport: "http",
		enabled: true,
		configPath: "/home/.claude.json",
		plugin: null,
		state: "available",
		...overrides,
	};
}

const linearAccount = (
	connected: boolean,
	installed = false,
): McpPluginAccount => ({
	displayName: "Linear",
	connector: "linear",
	connected,
	installed,
});

describe("mcpPickerRows", () => {
	it("puts usable servers first, then plugin actions, then unusable ones", () => {
		const rows = mcpPickerRows(
			[
				server({ name: "zed", state: "disabled", enabled: false }),
				server({ name: "codex-only", agent: "codex", state: "other-agent" }),
				server({
					name: "linear",
					configPath: "",
					state: "not-configured",
					plugin: { name: "linear", installed: false, proxied: true },
				}),
				server({ name: "docs" }),
			],
			new Map([["linear", linearAccount(false)]]),
			"",
		);

		expect(
			rows.map((row) => [
				row.server.name,
				row.kind,
				row.kind === "action" ? row.action : null,
			]),
		).toEqual([
			["docs", "available", null],
			["linear", "action", "connect"],
			["codex-only", "unavailable", null],
			["zed", "unavailable", null],
		]);
	});

	it("asks for an account only for a proxied server whose plugin is not connected", () => {
		const proxied = server({
			name: "linear",
			plugin: { name: "linear", installed: true, proxied: true },
		});
		const own = server({
			name: "linear-own",
			plugin: { name: "linear", installed: false, proxied: false },
		});
		const disconnected = new Map([["linear", linearAccount(false)]]);

		expect(
			mcpPickerRows([proxied, own], disconnected, "").map((row) => row.kind),
		).toEqual(["available", "action"]);
		expect(
			mcpPickerRows(
				[proxied],
				new Map([["linear", linearAccount(true)]]),
				"",
			)[0]?.kind,
		).toBe("available");
	});

	it("says an installed, connected plugin server arrives with the next session", () => {
		const [row] = mcpPickerRows(
			[
				server({
					name: "linear",
					configPath: "",
					state: "not-configured",
					plugin: { name: "linear", installed: true, proxied: true },
				}),
			],
			new Map([["linear", linearAccount(true)]]),
			"",
		);
		expect(row).toMatchObject({ kind: "unavailable", reason: "next-session" });
	});

	it("leaves out plugin servers the account catalog does not offer", () => {
		const rows = mcpPickerRows(
			[
				server({
					name: "chrome-devtools",
					configPath: "",
					state: "not-configured",
					plugin: { name: "chrome-devtools", installed: false, proxied: false },
				}),
			],
			new Map(),
			"",
		);
		expect(rows).toEqual([]);
	});

	it("counts an install on the account before this machine has written it", () => {
		const [row] = mcpPickerRows(
			[
				server({
					name: "linear",
					configPath: "",
					state: "not-configured",
					plugin: { name: "linear", installed: false, proxied: true },
				}),
			],
			new Map([["linear", linearAccount(true, true)]]),
			"",
		);
		expect(row).toMatchObject({ kind: "unavailable", reason: "next-session" });
	});

	it("searches names, plugin names, agents, and scopes", () => {
		const rows = mcpPickerRows(
			[
				server({ name: "docs" }),
				server({
					name: "lin",
					plugin: { name: "linear", installed: true, proxied: false },
				}),
			],
			new Map([["linear", linearAccount(true)]]),
			"LINEAR",
		);
		expect(rows.map((row) => row.server.name)).toEqual(["lin"]);
	});
});
