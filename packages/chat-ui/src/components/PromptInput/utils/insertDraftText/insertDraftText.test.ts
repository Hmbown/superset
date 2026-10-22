import { describe, expect, it } from "bun:test";
import {
	$createParagraphNode,
	$getRoot,
	$isElementNode,
	createEditor,
	type LexicalEditor,
} from "lexical";
import { MentionChipNode } from "../../nodes/mentionChipNode";
import { $insertDraftText } from "./insertDraftText";

const issueChip = { label: "Fix the mic", serialized: "@SUP-12" };

function emptyEditor(): LexicalEditor {
	const editor = createEditor({
		namespace: "insert-draft-text-test",
		nodes: [MentionChipNode],
		onError: (error) => {
			throw error;
		},
	});
	editor.update(
		() => {
			$getRoot().clear().append($createParagraphNode());
			$getRoot().selectEnd();
		},
		{ discrete: true },
	);
	return editor;
}

const children = (editor: LexicalEditor) =>
	editor.getEditorState().read(() => {
		const paragraph = $getRoot().getFirstChild();
		return $isElementNode(paragraph)
			? paragraph
					.getChildren()
					.map((node) =>
						node instanceof MentionChipNode
							? `chip:${node.toChip().label}`
							: `text:${node.getTextContent()}`,
					)
			: [];
	});

describe("$insertDraftText", () => {
	it("puts each chip back where the draft held it", () => {
		const editor = emptyEditor();
		editor.update(
			() =>
				$insertDraftText("see @SUP-12 now", [
					{ start: 4, end: 11, chip: issueChip },
				]),
			{ discrete: true },
		);
		expect(children(editor)).toEqual([
			"text:see ",
			"chip:Fix the mic",
			"text: now",
		]);
	});

	it("keeps a span as text when it no longer reads as its chip", () => {
		const editor = emptyEditor();
		editor.update(
			() =>
				$insertDraftText("see @SUP-13", [
					{ start: 4, end: 11, chip: issueChip },
				]),
			{ discrete: true },
		);
		expect(children(editor)).toEqual(["text:see @SUP-13"]);
	});
});
