import { describe, expect, it, mock } from "bun:test";
import {
	isPointInsideCardCone,
	isPointInTriangle,
	trackSafeTriangle,
} from "./safeTriangle";

function cardAt(left: number, top: number, width: number, height: number) {
	const element = document.createElement("div");
	element.getBoundingClientRect = () =>
		({
			left,
			top,
			right: left + width,
			bottom: top + height,
			width,
			height,
			x: left,
			y: top,
			toJSON: () => ({}),
		}) as DOMRect;
	return element;
}

describe("safeTriangle", () => {
	it("accepts points inside and on the edges, rejects points outside", () => {
		const a = { x: 0, y: 0 };
		const b = { x: 10, y: 0 };
		const c = { x: 0, y: 10 };
		expect(isPointInTriangle({ x: 2, y: 2 }, a, b, c)).toBe(true);
		expect(isPointInTriangle({ x: 5, y: 5 }, a, b, c)).toBe(true);
		expect(isPointInTriangle({ x: 6, y: 6 }, a, b, c)).toBe(false);
	});

	it("bases the cone on the card's near edge, honouring a flipped side", () => {
		const apex = { x: 100, y: 50 };
		const right = cardAt(140, 0, 200, 100);
		expect(isPointInsideCardCone({ x: 120, y: 50 }, apex, right)).toBe(true);
		expect(isPointInsideCardCone({ x: 120, y: 140 }, apex, right)).toBe(false);
		const left = cardAt(-300, 0, 200, 100);
		left.setAttribute("data-side", "left");
		expect(isPointInsideCardCone({ x: 0, y: 50 }, apex, left)).toBe(true);
		expect(isPointInsideCardCone({ x: 120, y: 50 }, apex, left)).toBe(false);
	});

	it("abandons when the pointer leaves the cone, and on the deadline", () => {
		const card = cardAt(140, 0, 200, 100);
		const onAbandon = mock(() => {});
		const stop = trackSafeTriangle({
			apex: { x: 100, y: 50 },
			getCardElement: () => card,
			onAbandon,
			maxTrackMs: 10_000,
		});
		document.dispatchEvent(
			new MouseEvent("mousemove", { clientX: 120, clientY: 50 }),
		);
		expect(onAbandon).not.toHaveBeenCalled();
		document.dispatchEvent(
			new MouseEvent("mousemove", { clientX: 120, clientY: 140 }),
		);
		expect(onAbandon).toHaveBeenCalledTimes(1);
		stop();

		const onDeadline = mock(() => {});
		const stopDeadline = trackSafeTriangle({
			apex: { x: 100, y: 50 },
			getCardElement: () => card,
			onAbandon: onDeadline,
			maxTrackMs: 5,
		});
		return new Promise<void>((resolve) =>
			setTimeout(() => {
				expect(onDeadline).toHaveBeenCalledTimes(1);
				stopDeadline();
				resolve();
			}, 20),
		);
	});
});
