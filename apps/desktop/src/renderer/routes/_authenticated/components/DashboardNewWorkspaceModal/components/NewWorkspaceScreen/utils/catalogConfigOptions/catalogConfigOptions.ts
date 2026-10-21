import type { SessionConfigOption } from "@superset/chat/protocol";
import type { AgentModelOption } from "@superset/shared/agent-models";

export const DEFAULT_CHOICE_ID = "__default__";

export const MODEL_CONFIG_ID = "model";
export const EFFORT_CONFIG_ID = "effort";

export function catalogConfigOptions({
	models,
	model,
	efforts,
	effort,
	labels,
}: {
	models: readonly AgentModelOption[] | undefined;
	model: string | null;
	efforts: readonly AgentModelOption[];
	effort: string | null;
	labels: {
		model: string;
		defaultModel: string;
		effort: string;
		defaultEffort: string;
	};
}): SessionConfigOption[] {
	const options: SessionConfigOption[] = [];
	if (models) {
		options.push({
			id: MODEL_CONFIG_ID,
			label: labels.model,
			category: "model",
			currentValue: model ?? DEFAULT_CHOICE_ID,
			options: [
				{ id: DEFAULT_CHOICE_ID, label: labels.defaultModel },
				...models.map(({ id, label }) => ({ id, label })),
			],
		});
	}
	if (efforts.length > 0) {
		options.push({
			id: EFFORT_CONFIG_ID,
			label: labels.effort,
			category: "thought_level",
			currentValue: effort ?? DEFAULT_CHOICE_ID,
			options: [
				{ id: DEFAULT_CHOICE_ID, label: labels.defaultEffort },
				...efforts.map(({ id, label }) => ({ id, label })),
			],
		});
	}
	return options;
}

export function choiceValue(value: string): string | null {
	return value === DEFAULT_CHOICE_ID ? null : value;
}

const LAUNCH_MODE_PREFIX = "launch:";

export function catalogLaunchModes(
	modes: readonly AgentModelOption[],
	directLabel: string,
): { id: string; label: string }[] {
	return [
		{ id: DEFAULT_CHOICE_ID, label: directLabel },
		...modes.map(({ id, label }) => ({ id: LAUNCH_MODE_PREFIX + id, label })),
	];
}

export function launchModeId(mode: string | null): string {
	return mode === null ? DEFAULT_CHOICE_ID : LAUNCH_MODE_PREFIX + mode;
}

export function launchModeValue(id: string): string | null {
	return id.startsWith(LAUNCH_MODE_PREFIX)
		? id.slice(LAUNCH_MODE_PREFIX.length)
		: null;
}
