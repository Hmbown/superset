import { desiredPluginMcpServers } from "@superset/shared/plugins";
import type { CatalogPlugin } from "renderer/hooks/usePluginCatalog";

export interface McpPickerPlugin {
	name: string;
	displayName: string;
	servers: readonly string[];
	connector: string | null;
	connected: boolean;
	installed: boolean;
}

export function mcpPickerPlugins(
	catalog: readonly CatalogPlugin[],
	installedHere: ReadonlySet<string> = new Set(),
): McpPickerPlugin[] {
	return catalog.flatMap((plugin) => {
		const servers = Object.keys(
			desiredPluginMcpServers([
				{ name: plugin.name, marketplace: plugin.marketplace },
			]),
		);
		if (!servers.length) return [];
		return [
			{
				name: plugin.name,
				displayName: plugin.interface.displayName,
				servers,
				connector: plugin.connector,
				connected: plugin.connections.length > 0,
				installed: plugin.installed || installedHere.has(plugin.name),
			},
		];
	});
}
