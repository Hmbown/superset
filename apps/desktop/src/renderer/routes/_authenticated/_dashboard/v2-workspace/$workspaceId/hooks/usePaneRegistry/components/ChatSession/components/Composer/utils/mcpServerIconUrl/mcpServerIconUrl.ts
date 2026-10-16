import type { McpServerEntry } from "@superset/shared/mcp-servers";
import { getPresetIcon } from "renderer/assets/app-icons/preset-icons";
import { getPluginIconUrl } from "renderer/components/PluginIcon";

/** The plugin's mark for a plugin server, else the agent whose config holds it. */
export function mcpServerIconUrl(
	server: Pick<McpServerEntry, "agent" | "plugin">,
	isDark: boolean,
): string | undefined {
	return server.plugin
		? getPluginIconUrl(server.plugin.name, isDark)
		: getPresetIcon(server.agent, isDark);
}
