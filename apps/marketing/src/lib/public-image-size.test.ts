import { afterAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPublicImageSize } from "./public-image-size";

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "public-image-size-"));
const publicDir = path.join(rootDir, "public");
const svg =
	'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"></svg>';
fs.mkdirSync(path.join(publicDir, "blog"), { recursive: true });
fs.writeFileSync(path.join(publicDir, "blog", "wide shot.svg"), svg);
fs.writeFileSync(path.join(rootDir, "secret.svg"), svg);

afterAll(() => fs.rmSync(rootDir, { recursive: true, force: true }));

describe("getPublicImageSize", () => {
	test("reads the size of a file in public/", () => {
		expect(getPublicImageSize("/blog/wide%20shot.svg?v=2", publicDir)).toEqual({
			width: 1200,
			height: 630,
		});
	});

	test("returns null for a missing file, so the image renders unsized", () => {
		expect(getPublicImageSize("/blog/missing.png", publicDir)).toBeNull();
	});

	test("ignores remote URLs and paths outside public/", () => {
		expect(
			getPublicImageSize("https://example.com/a.png", publicDir),
		).toBeNull();
		expect(getPublicImageSize("//cdn.example.com/a.png", publicDir)).toBeNull();
		expect(getPublicImageSize("/../secret.svg", publicDir)).toBeNull();
		expect(getPublicImageSize("/blog/100%.png", publicDir)).toBeNull();
	});
});
