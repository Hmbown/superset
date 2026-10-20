import type { McpServerEntry } from "@superset/shared/mcp-servers";

export interface McpPluginAccount {
	displayName: string;
	connector: string | null;
	connected: boolean;
}

export type McpPickerRow =
	| { key: string; server: McpServerEntry; kind: "available" }
	| {
			key: string;
			server: McpServerEntry;
			kind: "action";
			action: "install";
			plugin: string;
	  }
	| {
			key: string;
			server: McpServerEntry;
			kind: "action";
			action: "connect";
			plugin: string;
			connector: string;
	  }
	| {
			key: string;
			server: McpServerEntry;
			kind: "unavailable";
			reason: "disabled" | "other-agent" | "untrusted" | "next-session";
	  };

export type McpPickerActionRow = Extract<McpPickerRow, { kind: "action" }>;

const ORDER = { available: 0, action: 1, unavailable: 2 } as const;

function rowFor(
	server: McpServerEntry,
	plugins: ReadonlyMap<string, McpPluginAccount>,
): McpPickerRow | null {
	const key = `${server.agent}:${server.scope}:${server.configPath}:${server.name}`;
	if (
		server.state === "disabled" ||
		server.state === "other-agent" ||
		server.state === "untrusted"
	) {
		return { key, server, kind: "unavailable", reason: server.state };
	}
	const plugin = server.plugin;
	const account = plugin ? plugins.get(plugin.name) : undefined;
	if (server.state === "not-configured" && !account) return null;
	if (!plugin || !account) return { key, server, kind: "available" };

	const connect: McpPickerRow | null =
		account.connector && !account.connected
			? {
					key,
					server,
					kind: "action",
					action: "connect",
					plugin: plugin.name,
					connector: account.connector,
				}
			: null;
	if (server.state === "not-configured") {
		if (connect) return connect;
		if (!plugin.installed) {
			return {
				key,
				server,
				kind: "action",
				action: "install",
				plugin: plugin.name,
			};
		}
		return { key, server, kind: "unavailable", reason: "next-session" };
	}
	if (plugin.proxied && connect) return connect;
	return { key, server, kind: "available" };
}

export function mcpPickerRows(
	servers: readonly McpServerEntry[],
	plugins: ReadonlyMap<string, McpPluginAccount>,
	query: string,
): McpPickerRow[] {
	const search = query.trim().toLowerCase();
	return servers
		.filter((server) => {
			if (!search) return true;
			const pluginName = server.plugin
				? (plugins.get(server.plugin.name)?.displayName ?? server.plugin.name)
				: "";
			return `${server.name} ${pluginName} ${server.agent} ${server.scope}`
				.toLowerCase()
				.includes(search);
		})
		.flatMap((server) => rowFor(server, plugins) ?? [])
		.sort(
			(a, b) =>
				ORDER[a.kind] - ORDER[b.kind] ||
				a.server.name.localeCompare(b.server.name) ||
				a.key.localeCompare(b.key),
		);
}
