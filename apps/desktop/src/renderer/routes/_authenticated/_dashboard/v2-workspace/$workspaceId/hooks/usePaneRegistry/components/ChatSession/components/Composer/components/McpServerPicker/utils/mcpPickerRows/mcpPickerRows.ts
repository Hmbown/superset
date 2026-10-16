import type { McpServerEntry } from "@superset/shared/mcp-servers";

/** What the account catalog knows about a plugin. */
export interface McpPluginAccount {
	displayName: string;
	/** Connector slug; null when the plugin needs no account. */
	connector: string | null;
	connected: boolean;
	installed: boolean;
}

export type McpPickerRow =
	| { key: string; server: McpServerEntry; kind: "available" }
	| {
			key: string;
			server: McpServerEntry;
			kind: "action";
			action: "install" | "connect";
			plugin: string;
			displayName: string;
			/** Installed on this machine or on the account. */
			installed: boolean;
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
): McpPickerRow | null {
	const key = `${server.agent}:${server.scope}:${server.configPath}:${server.name}`;
	if (server.state === "disabled" || server.state === "other-agent") {
		return { key, server, kind: "unavailable", reason: server.state };
	}
	const plugin = server.plugin;
	const account = plugin ? plugins.get(plugin.name) : undefined;
	if (server.state === "not-configured" && !account) return null;
	if (!plugin || !account) return { key, server, kind: "available" };

	const installed = plugin.installed || account.installed;
	const needsAccount = Boolean(account.connector && !account.connected);
	const action = (kind: "install" | "connect"): McpPickerRow => ({
		key,
		server,
		kind: "action",
		action: kind,
		plugin: plugin.name,
		displayName: account.displayName,
		installed,
		connector: account.connector,
		needsAccount,
	});
	if (server.state === "not-configured") {
		if (needsAccount) return action("connect");
		if (!installed) return action("install");
		return { key, server, kind: "unavailable", reason: "next-session" };
	}
	if (plugin.proxied && needsAccount) return action("connect");
	return { key, server, kind: "available" };
}

/**
 * Servers the agent can use first, then plugins that need an install or an
 * account, then the ones it cannot use, each by name. A plugin server the
 * account catalog does not offer is left out, as on the Plugins page.
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
		.flatMap((server) => rowFor(server, plugins) ?? [])
		.sort(
			(a, b) =>
				ORDER[a.kind] - ORDER[b.kind] ||
				a.server.name.localeCompare(b.server.name) ||
				a.key.localeCompare(b.key),
		);
}
