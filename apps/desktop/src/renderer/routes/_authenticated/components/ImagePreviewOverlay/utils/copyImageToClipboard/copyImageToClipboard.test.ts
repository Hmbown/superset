import { describe, expect, mock, test } from "bun:test";
import { copyImageToClipboard } from "./copyImageToClipboard";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("copyImageToClipboard", () => {
	test("hands a PNG source to the writer as it is", async () => {
		const write = mock(async (_png: Blob) => {});
		await copyImageToClipboard(PNG, write);
		expect(write).toHaveBeenCalledTimes(1);
		const [png] = write.mock.calls[0] as [Blob];
		expect(png.type).toBe("image/png");
		expect(png.size).toBe(8);
	});

	test("a writer that rejects fails the copy", async () => {
		const write = mock(async () => {
			throw new Error("clipboard busy");
		});
		await expect(copyImageToClipboard(PNG, write)).rejects.toThrow(
			"clipboard busy",
		);
	});
});
