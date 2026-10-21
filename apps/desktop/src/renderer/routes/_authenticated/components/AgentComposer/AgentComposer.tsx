import type {
	ComposerChip,
	ComposerChipMatch,
	ComposerMentionEntry,
	ComposerMentionProvider,
	PromptInputAttachment,
	PromptInputCommand,
	PromptInputProps,
} from "@superset/chat-ui/PromptInput";
import { PromptInput } from "@superset/chat-ui/PromptInput";
import { useCallback, useMemo, useRef } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useAttachmentPreview } from "./hooks/useAttachmentPreview";
import { useComposerDictation } from "./hooks/useComposerDictation";
import { usePluginMentionProvider } from "./hooks/usePluginMentionProvider";
import { useTrackerMentionProvider } from "./hooks/useTrackerMentionProvider";

const NO_COMMANDS: PromptInputCommand[] = [];
const NO_PROVIDERS: ComposerMentionProvider[] = [];

export type AgentComposerProps = Omit<
	PromptInputProps,
	"mentionProviders" | "commands" | "findChips"
> & {
	mentionProviders?: ComposerMentionProvider[];
	commands?: PromptInputCommand[];
	findChips?: (text: string) => ComposerChipMatch[];
	onChipInsert?: (chip: ComposerChip) => void;
};

function sourcePathOf(file: File): string | null {
	try {
		return window.webUtils.getPathForFile(file) || null;
	} catch {
		return null;
	}
}

function reportingInserts(
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

export function AgentComposer({
	commands = NO_COMMANDS,
	mentionProviders = NO_PROVIDERS,
	dictation,
	findChips: findMoreChips,
	onChipInsert,
	onAttachmentClick: onAttachmentClickOverride,
	...props
}: AgentComposerProps) {
	const attachmentPreview = useAttachmentPreview();
	const openInFinder = electronTrpc.external.openInFinder.useMutation();
	const previewAttachment = attachmentPreview.onAttachmentClick;
	const revealInFinder = openInFinder.mutate;
	const onAttachmentClick = useCallback(
		(
			attachment: PromptInputAttachment,
			attachments: readonly PromptInputAttachment[],
		) => {
			if (previewAttachment(attachment, attachments)) return;
			const path = sourcePathOf(attachment.file);
			if (path) revealInFinder(path);
		},
		[previewAttachment, revealInFinder],
	);
	const { provider: pluginProvider, findChips: findPluginChips } =
		usePluginMentionProvider();
	const findChips = useCallback(
		(text: string) => {
			const matches = [
				...findPluginChips(text),
				...(findMoreChips?.(text) ?? []),
			].sort((a, b) => a.start - b.start);
			let end = 0;
			return matches.filter((match) => {
				if (match.start < end) return false;
				end = match.end;
				return true;
			});
		},
		[findPluginChips, findMoreChips],
	);
	const composerDictation = useComposerDictation();
	const trackerProvider = useTrackerMentionProvider();
	const onChipInsertRef = useRef(onChipInsert);
	onChipInsertRef.current = onChipInsert;
	const reportsInserts = onChipInsert !== undefined;
	const providers = useMemo(() => {
		const all = [
			pluginProvider,
			...(trackerProvider ? [trackerProvider] : []),
			...mentionProviders,
		];
		return reportsInserts
			? all.map((provider) =>
					reportingInserts(provider, (chip) => onChipInsertRef.current?.(chip)),
				)
			: all;
	}, [pluginProvider, trackerProvider, mentionProviders, reportsInserts]);
	return (
		<>
			<PromptInput
				{...props}
				onAttachmentClick={onAttachmentClickOverride ?? onAttachmentClick}
				commands={commands}
				dictation={dictation ?? composerDictation}
				findChips={findChips}
				mentionProviders={providers}
			/>
			{attachmentPreview.overlay}
		</>
	);
}
