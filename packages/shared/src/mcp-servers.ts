/**
 * The wire type for the MCP servers an agent can reach in a workspace, as the
 * host-service reads them from agent config files. Runtime-neutral so every
 * client can name it.
 */

export type McpServerAgent = "claude" | "codex";

export type McpServerScope = "user" | "project" | "local";

/**
 * - `available`: configured for the asking agent and enabled.
 * - `disabled`: configured for the asking agent but turned off in its config.
 * - `other-agent`: configured only for a different agent.
 * - `not-configured`: a Superset plugin server that is not in the asking
 *   agent's config yet (plugin not installed, or not written there yet).
 */
export type McpServerState =
	| "available"
	| "disabled"
	| "other-agent"
	| "not-configured";

export interface McpServerPlugin {
	/** Catalog name, which also keys the plugin's icon. */
	name: string;
	/** Installed and enabled on this machine. */
	installed: boolean;
	/** Points at Superset's plugin proxy, so it works only with a connected account. */
	proxied: boolean;
}

export interface McpServerEntry {
	name: string;
	agent: McpServerAgent;
	scope: McpServerScope;
	/** "stdio", "http", "sse", or what the config names. */
	transport: string;
	enabled: boolean;
	/** Empty for a plugin server that no config file holds yet. */
	configPath: string;
	plugin: McpServerPlugin | null;
	state: McpServerState;
}
