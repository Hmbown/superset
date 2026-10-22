import { describe, expect, test } from "bun:test";
import type {
	ComposerActionContext,
	ComposerChip,
	ComposerMentionProvider,
} from "@superset/chat-ui/PromptInput";
import { reportingInserts } from "./reportingInserts";

const chip: ComposerChip = { label: "PR #7", serialized: "@PR#7" };
const entry = {
	id: "pr-7",
	label: "PR #7",
	select: (ctx: ComposerActionContext) => ctx.insertChip(chip),
};

function context(inserted: ComposerChip[]): ComposerActionContext {
	const insertChip = (c: ComposerChip) => {
		inserted.push(c);
	};
	return { insertChip } as unknown as ComposerActionContext;
}

describe("reportingInserts", () => {
	test("reports a search entry's chip and still inserts it", async () => {
		const provider: ComposerMentionProvider = {
			id: "prs",
			title: "Pull requests",
			priority: 1,
			source: { kind: "search", emptyState: "", search: async () => [entry] },
		};
		const reported: ComposerChip[] = [];
		const inserted: ComposerChip[] = [];
		const wrapped = reportingInserts(provider, (c) => reported.push(c));
		if (wrapped.source.kind !== "search") throw new Error("kind changed");
		const [first] = await wrapped.source.search(
			"7",
			new AbortController().signal,
		);
		await first?.select(context(inserted));
		expect(reported).toEqual([chip]);
		expect(inserted).toEqual([chip]);
	});

	test("reports a static entry's chip too", async () => {
		const provider: ComposerMentionProvider = {
			id: "plugins",
			title: "Plugins",
			priority: 0,
			source: { kind: "static", load: () => [entry] },
		};
		const reported: ComposerChip[] = [];
		const wrapped = reportingInserts(provider, (c) => reported.push(c));
		if (wrapped.source.kind !== "static") throw new Error("kind changed");
		const [first] = await wrapped.source.load(new AbortController().signal);
		await first?.select(context([]));
		expect(reported).toEqual([chip]);
	});
});
