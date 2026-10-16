export type PastedTextEntry = { id: string; text: string };

type PasteStep = {
	before: PastedTextEntry[];
	after: PastedTextEntry[];
	textBefore: string;
	textAfter: string;
};

export type PasteUndoResult = {
	cards: PastedTextEntry[];
	// The step also changed the editor, so its own history must move too.
	editorChanged: boolean;
};

/**
 * Card changes live outside the editor's history. A step applies only while
 * the editor text is what it was right after (undo) or before (redo) it, so
 * card steps and typing undo in the order they happened.
 */
export function createPasteUndo() {
	let undoStack: PasteStep[] = [];
	let redoStack: PasteStep[] = [];
	return {
		record(step: PasteStep) {
			undoStack.push(step);
			redoStack = [];
		},
		undo(text: string): PasteUndoResult | null {
			const step = undoStack.at(-1);
			if (!step || step.textAfter !== text) return null;
			undoStack.pop();
			redoStack.push(step);
			return {
				cards: step.before,
				editorChanged: step.textBefore !== step.textAfter,
			};
		},
		redo(text: string): PasteUndoResult | null {
			const step = redoStack.at(-1);
			if (!step || step.textBefore !== text) return null;
			redoStack.pop();
			undoStack.push(step);
			return {
				cards: step.after,
				editorChanged: step.textBefore !== step.textAfter,
			};
		},
		reset() {
			undoStack = [];
			redoStack = [];
		},
	};
}
