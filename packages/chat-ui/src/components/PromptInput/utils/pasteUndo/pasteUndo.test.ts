import { describe, expect, it } from "bun:test";
import { createPasteUndo } from "./pasteUndo";

const card = { id: "1", text: "log" };

describe("createPasteUndo", () => {
	it("undoes a card only while the text is as it was after the paste", () => {
		const history = createPasteUndo();
		history.record({
			before: [],
			after: [card],
			textBefore: "hi",
			textAfter: "hi",
		});
		expect(history.undo("hi there")).toBeNull();
		expect(history.undo("hi")).toEqual({ cards: [], editorChanged: false });
		expect(history.undo("hi")).toBeNull();
		expect(history.redo("hi")).toEqual({ cards: [card], editorChanged: false });
	});

	it("marks a step that also changed the editor", () => {
		const history = createPasteUndo();
		history.record({
			before: [card],
			after: [],
			textBefore: "hi",
			textAfter: "hilog",
		});
		expect(history.undo("hilog")).toEqual({
			cards: [card],
			editorChanged: true,
		});
		expect(history.redo("hilog")).toBeNull();
		expect(history.redo("hi")).toEqual({ cards: [], editorChanged: true });
	});

	it("drops redo when a new step is recorded", () => {
		const history = createPasteUndo();
		const step = { before: [], after: [card], textBefore: "", textAfter: "" };
		history.record(step);
		history.undo("");
		history.record(step);
		expect(history.redo("")).toBeNull();
	});
});
