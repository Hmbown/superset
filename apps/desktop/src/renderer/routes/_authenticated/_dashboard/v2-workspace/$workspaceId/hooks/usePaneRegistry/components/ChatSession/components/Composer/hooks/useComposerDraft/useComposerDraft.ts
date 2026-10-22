import {
	type ComposerDraft,
	draftFromText,
	EMPTY_DRAFT,
	mergeDrafts,
} from "@superset/chat-ui/PromptInput";
import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_DEBOUNCE_MS = 300;
const STORED_DRAFT_VERSION = 2;

type StoredDraft = Pick<ComposerDraft, "text" | "chips" | "pastedTexts"> & {
	v: typeof STORED_DRAFT_VERSION;
};

// Attachments are files and stay in memory only, so a draft that holds any
// stays here after it is saved.
const unsavedDrafts = new Map<string, ComposerDraft>();
const recoveredAfterRead = new Map<string, ComposerDraft[]>();

function hasStoredContent(draft: ComposerDraft): boolean {
	return draft.text !== "" || draft.pastedTexts.length > 0;
}

function persistDraft(draftKey: string, draft: ComposerDraft): boolean {
	try {
		if (!hasStoredContent(draft)) {
			window.localStorage.removeItem(draftKey);
			return true;
		}
		const stored: StoredDraft = {
			v: STORED_DRAFT_VERSION,
			text: draft.text,
			chips: draft.chips,
			pastedTexts: draft.pastedTexts,
		};
		window.localStorage.setItem(draftKey, JSON.stringify(stored));
		return true;
	} catch (error) {
		console.warn("[chat] could not save the composer draft", error);
		return false;
	}
}

// Drafts saved before chips were kept are the composer's plain text.
export function parseStoredDraft(raw: string): ComposerDraft {
	if (raw.startsWith(`{"v":${STORED_DRAFT_VERSION},`)) {
		try {
			const stored = JSON.parse(raw) as StoredDraft;
			return {
				text: stored.text,
				chips: stored.chips ?? [],
				pastedTexts: stored.pastedTexts ?? [],
				attachments: [],
			};
		} catch {}
	}
	return draftFromText(raw);
}

function readDraft(draftKey: string): ComposerDraft | undefined {
	const unsaved = unsavedDrafts.get(draftKey);
	if (unsaved !== undefined) return unsaved;
	try {
		const raw = window.localStorage.getItem(draftKey);
		return raw === null ? undefined : parseStoredDraft(raw);
	} catch {
		return undefined;
	}
}

export function prependToDraft(
	draftKey: string,
	drafts: readonly ComposerDraft[],
	persisted = true,
) {
	const merged = mergeDrafts([...drafts, readDraft(draftKey) ?? EMPTY_DRAFT]);
	unsavedDrafts.set(draftKey, merged);
	if (persisted && persistDraft(draftKey, merged)) {
		if (merged.attachments.length === 0) unsavedDrafts.delete(draftKey);
	}
	recoveredAfterRead.set(draftKey, [
		...(recoveredAfterRead.get(draftKey) ?? []),
		...drafts,
	]);
}

export function takeRecoveredDraft(draftKey: string): ComposerDraft | null {
	const recovered = recoveredAfterRead.get(draftKey);
	recoveredAfterRead.delete(draftKey);
	return recovered?.length ? mergeDrafts(recovered) : null;
}

export function useComposerDraft(draftKey: string, persisted = true) {
	const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingDraftKey = useRef<string | null>(null);
	const flushDraft = useCallback(() => {
		if (draftTimer.current) clearTimeout(draftTimer.current);
		draftTimer.current = null;
		const key = pendingDraftKey.current;
		pendingDraftKey.current = null;
		if (key === null) return;
		const draft = unsavedDrafts.get(key);
		if (draft === undefined || !persistDraft(key, draft)) return;
		if (draft.attachments.length === 0) unsavedDrafts.delete(key);
	}, []);
	const onDraftChange = useCallback(
		(draft: ComposerDraft) => {
			const empty = !hasStoredContent(draft) && draft.attachments.length === 0;
			if (!persisted) {
				if (empty) unsavedDrafts.delete(draftKey);
				else unsavedDrafts.set(draftKey, draft);
				return;
			}
			if (draftTimer.current) clearTimeout(draftTimer.current);
			unsavedDrafts.set(draftKey, draft);
			pendingDraftKey.current = draftKey;
			draftTimer.current = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
		},
		[draftKey, persisted, flushDraft],
	);
	useEffect(() => flushDraft, [flushDraft]);

	const [seed, setSeed] = useState(() => {
		recoveredAfterRead.delete(draftKey);
		return { draftKey, draft: readDraft(draftKey) };
	});

	const clearDraft = useCallback(() => {
		unsavedDrafts.delete(draftKey);
		if (persisted) {
			if (draftTimer.current) clearTimeout(draftTimer.current);
			draftTimer.current = null;
			pendingDraftKey.current = null;
			persistDraft(draftKey, EMPTY_DRAFT);
		}
		setSeed({ draftKey, draft: undefined });
	}, [draftKey, persisted]);

	if (seed.draftKey !== draftKey) {
		recoveredAfterRead.delete(draftKey);
		setSeed({ draftKey, draft: readDraft(draftKey) });
	}

	return {
		storedDraft: seed.draftKey === draftKey ? seed.draft : readDraft(draftKey),
		onDraftChange,
		clearDraft,
	};
}
