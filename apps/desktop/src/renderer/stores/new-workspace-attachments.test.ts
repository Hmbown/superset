import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { PromptInputAttachment } from "@superset/chat-ui/PromptInput";
import {
	setNewWorkspaceAttachments,
	useNewWorkspaceAttachments,
} from "./new-workspace-attachments";
import { useNewWorkspaceDraftStore } from "./new-workspace-draft";

const image: PromptInputAttachment = {
	id: "file-1",
	file: new File(["png"], "one.png", { type: "image/png" }),
	previewUrl: "blob:renderer/one",
};
const notes: PromptInputAttachment = {
	id: "file-2",
	file: new File(["md"], "notes.md", { type: "text/markdown" }),
};

const attachments = () => useNewWorkspaceAttachments.getState().attachments;

describe("newWorkspaceAttachments", () => {
	const original = URL.revokeObjectURL;
	let revoked: string[] = [];
	beforeEach(() => {
		revoked = [];
		URL.revokeObjectURL = (url: string) => {
			revoked.push(url);
		};
		useNewWorkspaceAttachments.setState({ attachments: [] });
	});
	afterEach(() => {
		URL.revokeObjectURL = original;
	});

	it("keeps attachments across non-reset draft updates", () => {
		setNewWorkspaceAttachments([image]);
		useNewWorkspaceDraftStore.getState().updateDraft({ prompt: "hello" });
		expect(attachments()).toEqual([image]);
	});

	it("revokes the preview of an attachment that is dropped, and only that one", () => {
		setNewWorkspaceAttachments([image, notes]);
		setNewWorkspaceAttachments([image]);
		expect(revoked).toEqual([]);
		setNewWorkspaceAttachments([]);
		expect(revoked).toEqual(["blob:renderer/one"]);
	});

	it("clears attachments and revokes previews on draft reset", () => {
		setNewWorkspaceAttachments([image, notes]);
		useNewWorkspaceDraftStore.getState().resetDraft();
		expect(attachments()).toEqual([]);
		expect(revoked).toEqual(["blob:renderer/one"]);
	});
});
