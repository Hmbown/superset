import type {
	ComposerChip,
	ComposerChipMatch,
	ComposerDraft,
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
import { reportingInserts } from "./utils/reportingInserts";

const NO_COMMANDS: PromptInputCommand[] = [];
const NO_PROVIDERS: ComposerMentionProvider[] = [];

export type AgentComposerProps = Omit<
	PromptInputProps,
	"mentionProviders" | "commands"
> & {
	mentionProviders?: ComposerMentionProvider[];
	commands?: PromptInputCommand[];
	// Names chips in a draft stored as text, which carries none of its own.
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

function withFoundChips(
	draft: ComposerDraft,
	findChips: (text: string) => ComposerChipMatch[],
): ComposerDraft {
	const matches = [...draft.chips, ...findChips(draft.text)].sort(
		(a, b) => a.start - b.start,
	);
	let end = 0;
	const chips = matches.filter((match) => {
		if (match.start < end) return false;
		end = match.end;
		return true;
	});
	return chips.length === draft.chips.length ? draft : { ...draft, chips };
}

export function AgentComposer({
	commands = NO_COMMANDS,
	mentionProviders = NO_PROVIDERS,
	dictation,
	findChips: findMoreChips,
	draft,
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
	const chippedDraft = useMemo(() => {
		if (!draft) return draft;
		const withPluginChips = withFoundChips(draft, findPluginChips);
		return findMoreChips
			? withFoundChips(withPluginChips, findMoreChips)
			: withPluginChips;
	}, [draft, findPluginChips, findMoreChips]);
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
				draft={chippedDraft}
				mentionProviders={providers}
			/>
			{attachmentPreview.overlay}
		</>
	);
}
