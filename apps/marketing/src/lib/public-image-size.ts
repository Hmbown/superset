import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

export interface ImageDimensions {
	width: number;
	height: number;
}

const cache = new Map<string, ImageDimensions | null>();

// Functions do not bundle public/images (see next.config.ts), so a render
// outside the build gets null and the image keeps its old, unsized layout.
export function getPublicImageSize(
	src: string,
	publicDir = path.join(process.cwd(), "public"),
): ImageDimensions | null {
	if (!src.startsWith("/") || src.startsWith("//")) return null;
	let pathname: string;
	try {
		pathname = decodeURIComponent(src.split(/[?#]/)[0] ?? "");
	} catch {
		return null;
	}
	const filePath = path.join(publicDir, pathname);
	if (!filePath.startsWith(publicDir + path.sep)) return null;

	const cached = cache.get(filePath);
	if (cached !== undefined) return cached;

	let dimensions: ImageDimensions | null = null;
	try {
		const { width, height } = imageSize(fs.readFileSync(filePath));
		if (width && height) dimensions = { width, height };
	} catch {}
	cache.set(filePath, dimensions);
	return dimensions;
}
