import {
	$getRoot,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_LOW,
	COMMAND_PRIORITY_NORMAL,
	HISTORY_PUSH_TAG,
	type LexicalEditor,
	PASTE_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	isLargePaste,
	normalizePastedText,
} from "../../../../utils/pastedText";
import {
	createPasteUndo,
	type PastedTextCard,
	type PasteUndoResult,
} from "../../utils/pasteUndo";

function $editorText(): string {
	return $getRoot().getTextContent();
}

function toCards(texts: readonly string[]): PastedTextCard[] {
	return texts.map((text) => ({ id: crypto.randomUUID(), text }));
}

export function usePastedTexts(
	editor: LexicalEditor,
	{
		enabled,
		onCardsChange,
	}: {
		enabled: boolean;
		onCardsChange: (cards: PastedTextCard[], editorText: string) => void;
	},
) {
	const [cards, setCardsState] = useState<PastedTextCard[]>([]);
	const cardsRef = useRef(cards);
	const [history] = useState(createPasteUndo);
	const onCardsChangeRef = useRef(onCardsChange);
	onCardsChangeRef.current = onCardsChange;

	const readText = useCallback(
		() => editor.getEditorState().read($editorText),
		[editor],
	);
	const setCards = useCallback((next: PastedTextCard[], editorText: string) => {
		cardsRef.current = next;
		setCardsState(next);
		onCardsChangeRef.current(next, editorText);
	}, []);

	useEffect(() => {
		if (!enabled) return;
		const applyStep = (result: PasteUndoResult | null) => {
			if (!result) return false;
			setCards(result.cards, $editorText());
			// The editor's own history reverts the text half of the step.
			return !result.editorChanged;
		};
		const unregisterPaste = editor.registerCommand<ClipboardEvent>(
			PASTE_COMMAND,
			(event) => {
				if (!(event instanceof ClipboardEvent)) return false;
				const text = normalizePastedText(
					event.clipboardData?.getData("text/plain") ?? "",
				);
				if (!isLargePaste(text)) return false;
				event.preventDefault();
				const editorText = $editorText();
				const before = cardsRef.current;
				const after = [...before, ...toCards([text])];
				history.record({
					before,
					after,
					textBefore: editorText,
					textAfter: editorText,
				});
				setCards(after, editorText);
				return true;
			},
			COMMAND_PRIORITY_NORMAL,
		);
		const unregisterUndo = editor.registerCommand(
			UNDO_COMMAND,
			() => applyStep(history.undo($editorText())),
			COMMAND_PRIORITY_LOW,
		);
		const unregisterRedo = editor.registerCommand(
			REDO_COMMAND,
			() => applyStep(history.redo($editorText())),
			COMMAND_PRIORITY_LOW,
		);
		return () => {
			unregisterPaste();
			unregisterUndo();
			unregisterRedo();
		};
	}, [editor, enabled, history, setCards]);

	const remove = useCallback(
		(id: string) => {
			const before = cardsRef.current;
			const after = before.filter((card) => card.id !== id);
			const editorText = readText();
			history.record({
				before,
				after,
				textBefore: editorText,
				textAfter: editorText,
			});
			setCards(after, editorText);
			editor.focus();
		},
		[editor, history, readText, setCards],
	);

	const showInTextField = useCallback(
		(id: string) => {
			const before = cardsRef.current;
			const card = before.find((entry) => entry.id === id);
			if (!card) return;
			const after = before.filter((entry) => entry.id !== id);
			const textBefore = readText();
			setCards(after, textBefore);
			editor.update(
				() => {
					let selection = $getSelection();
					if (!$isRangeSelection(selection)) {
						$getRoot().selectEnd();
						selection = $getSelection();
					}
					if ($isRangeSelection(selection)) selection.insertRawText(card.text);
				},
				{
					tag: HISTORY_PUSH_TAG,
					onUpdate: () =>
						history.record({
							before,
							after,
							textBefore,
							textAfter: readText(),
						}),
				},
			);
			editor.focus();
		},
		[editor, history, readText, setCards],
	);

	// Cards from a stored draft or a returned prompt; not an undoable step.
	const restore = useCallback((texts: readonly string[]) => {
		if (texts.length === 0) return;
		const next = [...cardsRef.current, ...toCards(texts)];
		cardsRef.current = next;
		setCardsState(next);
	}, []);

	const clear = useCallback(() => {
		cardsRef.current = [];
		setCardsState([]);
		history.reset();
	}, [history]);

	return { cards, cardsRef, remove, showInTextField, restore, clear };
}
