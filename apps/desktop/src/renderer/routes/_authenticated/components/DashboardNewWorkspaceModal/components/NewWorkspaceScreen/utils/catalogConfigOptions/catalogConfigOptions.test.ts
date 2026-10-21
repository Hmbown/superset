import { describe, expect, test } from "bun:test";
import {
	catalogConfigOptions,
	catalogLaunchModes,
	choiceValue,
	DEFAULT_CHOICE_ID,
	launchModeId,
	launchModeValue,
} from "./catalogConfigOptions";

const labels = {
	model: "Model",
	defaultModel: "Default model",
	effort: "Effort",
	defaultEffort: "Default effort",
};

describe("catalogConfigOptions", () => {
	test("maps the catalog to model and thought_level options with a default first", () => {
		const options = catalogConfigOptions({
			models: [{ id: "opus", label: "Opus", group: "Latest" }],
			model: "opus",
			efforts: [{ id: "high", label: "High" }],
			effort: null,
			labels,
		});
		expect(options).toEqual([
			{
				id: "model",
				label: "Model",
				category: "model",
				currentValue: "opus",
				options: [
					{ id: DEFAULT_CHOICE_ID, label: "Default model" },
					{ id: "opus", label: "Opus" },
				],
			},
			{
				id: "effort",
				label: "Effort",
				category: "thought_level",
				currentValue: DEFAULT_CHOICE_ID,
				options: [
					{ id: DEFAULT_CHOICE_ID, label: "Default effort" },
					{ id: "high", label: "High" },
				],
			},
		]);
	});

	test("leaves out what the agent's catalog does not support", () => {
		expect(
			catalogConfigOptions({
				models: undefined,
				model: null,
				efforts: [],
				effort: null,
				labels,
			}),
		).toEqual([]);
	});

	test("choiceValue turns the default choice back into null", () => {
		expect(choiceValue(DEFAULT_CHOICE_ID)).toBeNull();
		expect(choiceValue("opus")).toBe("opus");
	});

	test("launch modes get ids ModePicker does not hide, and map back", () => {
		const modes = catalogLaunchModes(
			[{ id: "plan", label: "Plan first" }],
			"Direct mode",
		);
		expect(modes).toEqual([
			{ id: DEFAULT_CHOICE_ID, label: "Direct mode" },
			{ id: "launch:plan", label: "Plan first" },
		]);
		expect(launchModeId("plan")).toBe("launch:plan");
		expect(launchModeId(null)).toBe(DEFAULT_CHOICE_ID);
		expect(launchModeValue("launch:plan")).toBe("plan");
		expect(launchModeValue(DEFAULT_CHOICE_ID)).toBeNull();
	});
});
