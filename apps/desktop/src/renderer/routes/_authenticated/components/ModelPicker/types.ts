export type AgentChoice = {
	presetId: string;
	// Icon to show when presetId is not a preset, e.g. a custom agent config.
	iconId?: string;
	// The preset whose models these are, when presetId is not a preset.
	// Favorites are keyed by it so every surface shares them.
	launchPresetId?: string;
	label: string;
	models: { id: string; label: string }[];
};

/** Other agents the chat can move to; picking one of their models hands the conversation over. */
export type AgentSwitcher = {
	currentPresetId: string;
	agents: AgentChoice[];
	onSwitch: (
		presetId: string,
		model: { id: string; label: string } | null,
	) => void;
	onConfigureAgents?: () => void;
};
