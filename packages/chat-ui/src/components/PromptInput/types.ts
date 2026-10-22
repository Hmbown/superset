import type { ReactNode, Ref } from "react";

export type ComposerChip = {
	label: string;
	serialized: string;
	brandColor?: string;
	// Icon as a URL string so chips stay serializable data.
	iconUrl?: string;
	description?: string;
	data?: unknown;
};

export type ComposerChipMatch = {
	start: number;
	end: number;
	chip: ComposerChip;
};

export type ComposerActionContext = {
	insertChip(chip: ComposerChip): void;
	attachFiles(): void;
	openPanel(panel: ComposerPanelContent): void;
	query: string;
};

export type ComposerPanelControls = {
	close(): void;
};

export type ComposerPanelContent = {
	title: string;
	render: (controls: ComposerPanelControls) => ReactNode;
	// Drawn without the titled frame and closed by a press outside the
	// composer; the content owns its keyboard, including Escape.
	bare?: boolean;
};

export type ComposerMentionEntry = {
	id: string;
	label: string;
	description?: string;
	icon?: ReactNode;
	keywords?: string[];
	// When set, selecting rewrites the query to this value and keeps the menu
	// open (directory drilling); select() is not called.
	completionQuery?: string;
	select(ctx: ComposerActionContext): void | Promise<void>;
};

export type ComposerMentionSource =
	| {
			kind: "static";
			load(
				signal: AbortSignal,
			): ComposerMentionEntry[] | Promise<ComposerMentionEntry[]>;
	  }
	| {
			kind: "search";
			search(
				query: string,
				signal: AbortSignal,
			): Promise<ComposerMentionEntry[]>;
			emptyState: string;
			loadingState?: string;
	  };

export type ComposerMentionProvider = {
	id: string;
	title: string;
	priority: number;
	source: ComposerMentionSource;
};

export type PromptInputCommand = {
	id: string;
	title: string;
	hint?: string;
	description?: string;
	icon?: ReactNode;
	rightIcon?: ReactNode;
	group?: string;
	searchAliases?: string[];
	onSelect(ctx: ComposerActionContext): void | Promise<void>;
};

export type PromptInputAttachment = {
	id: string;
	file: File;
	// Object URL for image and video attachments, made by the composer. It
	// revokes the URLs it drops; a host that owns the list revokes on reset.
	previewUrl?: string;
	// Set by a host that uploads attachments as they are added.
	upload?: { state: "pending" } | { state: "error"; message: string };
};

// Everything the composer holds. Chips sit in `text` as their serialized form;
// `chips` says where, and keeps each one's identity.
export type ComposerDraft = {
	text: string;
	chips: ComposerChipMatch[];
	// Large pastes held as cards, in paste order.
	pastedTexts: string[];
	attachments: PromptInputAttachment[];
};

export type PromptInputSubmitPayload = {
	text: string;
	files: File[];
	mentions: ComposerChip[];
	// Large pastes held as cards, in paste order.
	pastedTexts: string[];
	steer: boolean;
	// The whole draft as sent, for handing back with restoreDraft.
	draft: ComposerDraft;
};

export type PromptInputDictationError = {
	message: string;
	canRetry: boolean;
};

export type PromptInputDictation = {
	// Reject with a DictationError to choose the message and whether retry
	// is offered; any other rejection is retryable. The signal aborts when
	// the user cancels or the composer unmounts.
	transcribe(
		audio: Blob,
		options: { signal: AbortSignal },
	): Promise<string> | string;
	// Surfaced for app-owned toasts; retryable failures also keep the
	// recording and show retry controls in the composer row.
	onError?(error: PromptInputDictationError): void;
	// Recording stops and transcribes on its own at this length.
	maxSeconds?: number;
	audioBitsPerSecond?: number;
};

export type PromptInputHandle = {
	// Adds a draft after what is in the composer: text, chips, pasted cards
	// and attachments.
	restoreDraft(draft: ComposerDraft): void;
	insertChip(chip: ComposerChip): void;
	openFileDialog(): void;
	openPanel(panel: ComposerPanelContent): void;
	focus(): void;
	recallPreviousPrompt(): void;
};

export type PromptInputProps = {
	ref?: Ref<PromptInputHandle>;
	placeholder?: string;
	mentionProviders: ComposerMentionProvider[];
	commands: PromptInputCommand[];
	status?: "ready" | "streaming";
	submitWhileStreaming?: boolean;
	// Enables the mic button; the app owns speech-to-text.
	dictation?: PromptInputDictation;
	toolbar?: ReactNode;
	toolbarEnd?: ReactNode;
	// The draft to open with, read once on mount; the composer owns the editor
	// from then on. While it is untouched, a new draft with more chips (a
	// catalog that finished loading) turns those spans into chips.
	draft?: ComposerDraft;
	// Every change to the draft, for persisting it.
	onDraftChange?: (draft: ComposerDraft) => void;
	// A paste of 25+ lines or 4,000+ chars becomes a card instead of text.
	collapseLargePastes?: boolean;
	/** Returning `false` keeps the draft in the editor. */
	onSubmit?: (
		payload: PromptInputSubmitPayload,
	) => false | void | Promise<void>;
	onStop?: () => void;
	stopOnEscape?: boolean;
	// Hands the attachment list to the host, which then owns it and passes it
	// back in; without these the composer keeps its own.
	attachments?: PromptInputAttachment[];
	onAttachmentsChange?: (attachments: PromptInputAttachment[]) => void;
	allowEmptySubmit?: boolean;
	// Blocks sending, from the button and from Enter; typing still works.
	disabled?: boolean;
	// A send the host is still handling: blocks sending and spins the button.
	pending?: boolean;
	autoFocus?: boolean;
	/** The clicked pill, and every pending attachment in order. */
	onAttachmentClick?: (
		attachment: PromptInputAttachment,
		attachments: readonly PromptInputAttachment[],
	) => void;
	history?: string[];
	className?: string;
};
