import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { PromptInputAttachment } from "@superset/chat-ui/PromptInput";
import { acceptAttachments } from "./acceptAttachments";

const attachment = (
	id: string,
	size = 10,
	previewUrl?: string,
): PromptInputAttachment => ({
	id,
	file: new File([new Uint8Array(size)], `${id}.png`, { type: "image/png" }),
	...(previewUrl ? { previewUrl } : {}),
});

describe("acceptAttachments", () => {
	const original = URL.revokeObjectURL;
	let revoked: string[] = [];
	beforeEach(() => {
		revoked = [];
		URL.revokeObjectURL = (url: string) => {
			revoked.push(url);
		};
	});
	afterEach(() => {
		URL.revokeObjectURL = original;
	});

	test("keeps what is stored and drops the host's upload state", () => {
		const stored = [attachment("a")];
		const next = [{ ...stored[0], upload: { state: "pending" as const } }];
		expect(acceptAttachments(stored, next, () => {})).toEqual(stored);
	});

	test("refuses a sixth file, and revokes its preview", () => {
		const stored = ["a", "b", "c", "d", "e"].map((id) => attachment(id));
		const extra = attachment("f", 10, "blob:f");
		const errors: string[] = [];
		const result = acceptAttachments(stored, [...stored, extra], (error) =>
			errors.push(error.code),
		);
		expect(result.map(({ id }) => id)).toEqual(["a", "b", "c", "d", "e"]);
		expect(errors).toEqual(["max_files"]);
		expect(revoked).toEqual(["blob:f"]);
	});

	test("refuses a file over 10 MB", () => {
		const big = attachment("big", 10 * 1024 * 1024 + 1, "blob:big");
		const errors: string[] = [];
		expect(
			acceptAttachments([], [big], (error) => errors.push(error.code)),
		).toEqual([]);
		expect(errors).toEqual(["max_file_size"]);
		expect(revoked).toEqual(["blob:big"]);
	});
});
