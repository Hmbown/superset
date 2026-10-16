import type { McpServerEntry } from "@superset/shared/mcp-servers";

/** What the account catalog knows about a plugin. */
export interface McpPluginAccount {
	displayName: string;
	/** Connector slug; null when the plugin needs no account. */
	connector: string | null;
	connected: boolean;
}

export type McpPickerRow =
	| { key: string; server: McpServerEntry; kind: "available" }
	| {
			key: string;
			server: McpServerEntry;
			kind: "action";
			action: "install" | "connect";
			plugin: string;
			connector: string | null;
			/** The connector has no connected account yet. */
			needsAccount: boolean;
	  }
	| {
			key: string;
			server: McpServerEntry;
			kind: "unavailable";
			reason: "disabled" | "other-agent" | "next-session";
	  };

export type McpPickerActionRow = Extract<McpPickerRow, { kind: "action" }>;

const ORDER = { available: 0, action: 1, unavailable: 2 } as const;

function rowFor(
	server: McpServerEntry,
	plugins: ReadonlyMap<string, McpPluginAccount>,
): McpPickerRow {
	const key = `${server.agent}:${server.scope}:${server.configPath}:${server.name}`;
	if (server.state === "disabled" || server.state === "other-agent") {
		return { key, server, kind: "unavailable", reason: server.state };
	}
	const plugin = server.plugin;
	const account = plugin ? plugins.get(plugin.name) : undefined;
	const connector = account?.connector ?? null;
	const needsAccount = Boolean(connector && !account?.connected);
	if (plugin && server.state === "not-configured") {
		if (!plugin.installed) {
			return {
				key,
				server,
				kind: "action",
				action: needsAccount ? "connect" : "install",
				plugin: plugin.name,
				connector,
				needsAccount,
			};
		}
		if (needsAccount) {
			return {
				key,
				server,
				kind: "action",
				action: "connect",
				plugin: plugin.name,
				connector,
				needsAccount,
			};
		}
		return { key, server, kind: "unavailable", reason: "next-session" };
	}
	if (plugin?.proxied && needsAccount) {
		return {
			key,
			server,
			kind: "action",
			action: "connect",
			plugin: plugin.name,
			connector,
			needsAccount,
		};
	}
	return { key, server, kind: "available" };
}

/**
 * Servers the agent can use first, then plugins that need an install or an
 * account, then the ones it cannot use, each by name.
 */
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
		.map((server) => rowFor(server, plugins))
		.sort(
			(a, b) =>
				ORDER[a.kind] - ORDER[b.kind] ||
				a.server.name.localeCompare(b.server.name) ||
				a.key.localeCompare(b.key),
		);
}
