import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import type { PromptInputAttachment } from "../../../../types";

export function UploadOverlay({
	upload,
}: {
	upload: PromptInputAttachment["upload"];
}) {
	if (!upload) return null;
	return (
		<span
			className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60"
			title={upload.state === "error" ? upload.message : undefined}
		>
			{upload.state === "error" ? (
				<TriangleAlertIcon className="size-4 text-destructive" />
			) : (
				<LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
			)}
		</span>
	);
}
