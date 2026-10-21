import type { PromptInputAttachment } from "@superset/chat-ui/PromptInput";
import { useCallback, useEffect } from "react";
import {
	awaitUploads,
	pruneAttachmentUploads,
	readyAttachmentId,
	startUpload,
} from "./store";

export interface UploadFailure {
	filename?: string;
	message: string;
}

export interface UseUploadAttachmentsApi {
	awaitUploads: () => Promise<{
		readyIds: string[];
		ready: Array<{ attachmentId: string; name: string; mimeType: string }>;
		errors: UploadFailure[];
	}>;
}

/**
 * Drives background attachment uploads. Every attached file is uploaded to
 * the current target, so switching the picker uploads the files to the new
 * target too: what the pill list shows for a target is what the create will
 * send to it. The store keys uploads by `(fileId, target)` and starts each
 * pair once, so a file never uploads twice to the same target and an earlier
 * target's upload stays cached for a return visit.
 *
 * A target is a host URL, or `CLOUD_UPLOAD_TARGET` when the workspace will be
 * a cloud one and has no host yet.
 */
export function useUploadAttachments({
	attachments,
	hostUrl,
}: {
	attachments: readonly PromptInputAttachment[];
	hostUrl: string | null;
}): UseUploadAttachmentsApi {
	useEffect(() => {
		if (hostUrl) {
			for (const { id, file } of attachments)
				startUpload(hostUrl, { id, file });
		}
		pruneAttachmentUploads(new Set(attachments.map(({ id }) => id)));
	}, [attachments, hostUrl]);

	const awaitForCurrent = useCallback(async () => {
		if (!hostUrl) return { readyIds: [], ready: [], errors: [] };
		const result = await awaitUploads(
			hostUrl,
			attachments.map(({ id }) => id),
		);
		const errors: UploadFailure[] = result.failures.map((failure) => ({
			filename: attachments.find(({ id }) => id === failure.fileId)?.file.name,
			message: failure.message,
		}));
		const ready = attachments.flatMap(({ id, file }) => {
			const attachmentId = readyAttachmentId(id, hostUrl);
			return attachmentId
				? [
						{
							attachmentId,
							name: file.name || attachmentId,
							mimeType: file.type || "application/octet-stream",
						},
					]
				: [];
		});
		return { readyIds: result.readyIds, ready, errors };
	}, [hostUrl, attachments]);

	return { awaitUploads: awaitForCurrent };
}
