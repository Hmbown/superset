import { parsePastedText } from "@superset/chat/core";
import type {
	ComposerChip,
	ComposerChipMatch,
	ComposerDraft,
} from "../../types";

export const EMPTY_DRAFT: ComposerDraft = {
	text: "",
	chips: [],
	pastedTexts: [],
	attachments: [],
};

export function isDraftEmpty(draft: ComposerDraft): boolean {
	return (
		draft.text.trim() === "" &&
		draft.pastedTexts.length === 0 &&
		draft.attachments.length === 0
	);
}

/** Where each chip sits in `text`, which holds every chip as its serialized form. */
export function placeChips(
	text: string,
	chips: readonly ComposerChip[],
): ComposerChipMatch[] {
	const placed: ComposerChipMatch[] = [];
	let cursor = 0;
	for (const chip of chips) {
		if (!chip.serialized) continue;
		const start = text.indexOf(chip.serialized, cursor);
		if (start === -1) continue;
		const end = start + chip.serialized.length;
		placed.push({ start, end, chip });
		cursor = end;
	}
	return placed;
}

/** A draft from plain text, as older stored drafts and sent messages hold it. */
export function draftFromText(
	message: string,
	{ splitPastes = true }: { splitPastes?: boolean } = {},
): ComposerDraft {
	const { text, pastes } = splitPastes
		? parsePastedText(message)
		: { text: message, pastes: [] };
	return { ...EMPTY_DRAFT, text, pastedTexts: pastes };
}

/** Drafts joined in order: texts with `separator`, chips moved along with them. */
export function mergeDrafts(
	drafts: readonly ComposerDraft[],
	separator = "\n\n",
): ComposerDraft {
	let text = "";
	const chips: ComposerChipMatch[] = [];
	for (const draft of drafts) {
		if (draft.text.trim() === "" && draft.chips.length === 0) continue;
		const offset = text === "" ? 0 : text.length + separator.length;
		text = text === "" ? draft.text : `${text}${separator}${draft.text}`;
		for (const match of draft.chips) {
			chips.push({
				...match,
				start: match.start + offset,
				end: match.end + offset,
			});
		}
	}
	return {
		text,
		chips,
		pastedTexts: drafts.flatMap((draft) => draft.pastedTexts),
		attachments: drafts.flatMap((draft) => draft.attachments),
	};
}

const isTokenChar = (char: string | undefined) =>
	char !== undefined && /[\w-]/.test(char);

/** Finds each chip's serialized form in `text`, as a whole token. */
export function chipFinder(
	chips: readonly ComposerChip[],
): (text: string) => ComposerChipMatch[] {
	const bySerialized = new Map<string, ComposerChip>();
	for (const chip of chips) {
		if (chip.serialized) bySerialized.set(chip.serialized, chip);
	}
	const tokens = [...bySerialized.keys()].sort((a, b) => b.length - a.length);
	return (text) => {
		const matches: ComposerChipMatch[] = [];
		let cursor = 0;
		while (cursor < text.length) {
			let best: ComposerChipMatch | null = null;
			for (const token of tokens) {
				let start = text.indexOf(token, cursor);
				while (
					start !== -1 &&
					(isTokenChar(text[start - 1]) ||
						isTokenChar(text[start + token.length]))
				) {
					start = text.indexOf(token, start + 1);
				}
				if (start === -1 || (best && start >= best.start)) continue;
				const chip = bySerialized.get(token);
				if (chip) best = { start, end: start + token.length, chip };
			}
			if (!best) break;
			matches.push(best);
			cursor = best.end;
		}
		return matches;
	};
}
