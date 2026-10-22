import type {
	ComposerChip,
	ComposerMentionEntry,
	ComposerMentionProvider,
} from "@superset/chat-ui/PromptInput";

/** The provider, telling `onChipInsert` about every chip its entries insert. */
export function reportingInserts(
	provider: ComposerMentionProvider,
	onChipInsert: (chip: ComposerChip) => void,
): ComposerMentionProvider {
	const wrap = (entries: ComposerMentionEntry[]) =>
		entries.map((entry) => ({
			...entry,
			select: (ctx: Parameters<ComposerMentionEntry["select"]>[0]) =>
				entry.select({
					...ctx,
					insertChip: (chip) => {
						onChipInsert(chip);
						ctx.insertChip(chip);
					},
				}),
		}));
	const { source } = provider;
	return {
		...provider,
		source:
			source.kind === "static"
				? {
						...source,
						load: async (signal) => wrap(await source.load(signal)),
					}
				: {
						...source,
						search: async (query, signal) =>
							wrap(await source.search(query, signal)),
					},
	};
}
