import type { PromptInputAttachment } from "@superset/chat-ui/PromptInput";
import {
	type AttachmentConstraintError,
	applyAttachmentConstraints,
} from "@superset/ui/lib/attachment-constraints";

export const NEW_WORKSPACE_ATTACHMENT_LIMITS = {
	maxFiles: 5,
	maxFileSize: 10 * 1024 * 1024,
};

/**
 * The composer's next attachment list, with newly added files held to the
 * limits. Rejected files lose their preview URL, since nothing else will.
 */
export function acceptAttachments(
	stored: readonly PromptInputAttachment[],
	next: readonly PromptInputAttachment[],
	onError: (error: AttachmentConstraintError) => void,
): PromptInputAttachment[] {
	const known = new Set(stored.map(({ id }) => id));
	const added = next.filter(({ id }) => !known.has(id));
	const accepted = new Set(
		applyAttachmentConstraints({
			files: added.map(({ file }) => file),
			currentCount: next.length - added.length,
			constraints: NEW_WORKSPACE_ATTACHMENT_LIMITS,
			onError,
		}),
	);
	for (const { file, previewUrl } of added) {
		if (previewUrl && !accepted.has(file)) URL.revokeObjectURL(previewUrl);
	}
	return next
		.filter(({ id, file }) => known.has(id) || accepted.has(file))
		.map(({ upload: _upload, ...attachment }) => attachment);
}
