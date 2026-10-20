import type { McpServerEntry } from "@superset/shared/mcp-servers";
import type { McpPickerPlugin } from "../../../../utils/mcpPickerPlugins";

interface RowBase {
	key: string;
	name: string;
	plugin: McpPickerPlugin | null;
	server: McpServerEntry | null;
}

export type McpPickerRow = RowBase &
	(
		| { kind: "available"; server: McpServerEntry }
		| { kind: "action"; action: "install"; plugin: McpPickerPlugin }
		| {
				kind: "action";
				action: "connect";
				plugin: McpPickerPlugin;
				connector: string;
		  }
		| {
				kind: "unavailable";
				reason: "disabled" | "other-agent" | "untrusted" | "next-session";
		  }
	);

export type McpPickerActionRow = Extract<McpPickerRow, { kind: "action" }>;

const ORDER = { available: 0, action: 1, unavailable: 2 } as const;

function configuredRow(
	server: McpServerEntry,
	plugins: readonly McpPickerPlugin[],
): McpPickerRow {
	const plugin =
		plugins.find(
			(candidate) =>
				candidate.installed && candidate.servers.includes(server.name),
		) ?? null;
	const base = {
		key: `${server.agent}:${server.scope}:${server.configPath}:${server.name}`,
		name: server.name,
		plugin,
		server,
	};
	if (server.state !== "available")
		return { ...base, kind: "unavailable", reason: server.state };
	if (plugin?.connector && !plugin.connected)
		return {
			...base,
			kind: "action",
			action: "connect",
			plugin,
			connector: plugin.connector,
		};
	return { ...base, kind: "available", server };
}

function setupRows(
	servers: readonly McpServerEntry[],
	plugins: readonly McpPickerPlugin[],
): McpPickerRow[] {
	const configured = new Set(
		servers
			.filter((server) => server.state !== "other-agent")
			.map((server) => server.name),
	);
	return plugins.flatMap((plugin) =>
		plugin.servers
			.filter((name) => !configured.has(name))
			.map((name): McpPickerRow => {
				const base = {
					key: `plugin:${plugin.name}:${name}`,
					name,
					plugin,
					server: null,
				};
				if (plugin.connector && !plugin.connected)
					return {
						...base,
						kind: "action",
						action: "connect",
						plugin,
						connector: plugin.connector,
					};
				if (!plugin.installed)
					return { ...base, kind: "action", action: "install", plugin };
				return { ...base, kind: "unavailable", reason: "next-session" };
			}),
	);
}

export function mcpPickerRows(
	servers: readonly McpServerEntry[],
	plugins: readonly McpPickerPlugin[],
	query: string,
): McpPickerRow[] {
	const search = query.trim().toLowerCase();
	return [
		...servers.map((server) => configuredRow(server, plugins)),
		...setupRows(servers, plugins),
	]
		.filter(
			(row) =>
				!search ||
				[
					row.name,
					row.plugin?.displayName,
					row.server?.agent,
					row.server?.scope,
				]
					.join(" ")
					.toLowerCase()
					.includes(search),
		)
		.sort(
			(a, b) =>
				ORDER[a.kind] - ORDER[b.kind] ||
				a.name.localeCompare(b.name) ||
				a.key.localeCompare(b.key),
		);
}
