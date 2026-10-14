export interface Point {
	x: number;
	y: number;
}

// Cap how long we'll tolerate the pointer drifting inside the safe triangle
// before giving up and closing anyway, in case it stalls mid-gap.
export const SAFE_TRIANGLE_MAX_TRACK_MS = 1000;

// Standard same-sign point-in-triangle test via cross-product signs.
function triangleSign(p1: Point, p2: Point, p3: Point): number {
	return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

export function isPointInTriangle(
	pt: Point,
	a: Point,
	b: Point,
	c: Point,
): boolean {
	const d1 = triangleSign(pt, a, b);
	const d2 = triangleSign(pt, b, c);
	const d3 = triangleSign(pt, c, a);
	const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
	const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
	return !(hasNegative && hasPositive);
}

// The two corners of the card's near edge — the base of the safe triangle.
// A card configured for the trigger's right (side="right") can be flipped
// to the left by Radix's collision avoidance (a sidebar dragged wide, or a
// narrow window), so read the resolved side off the element.
function getNearCardCorners(
	cardElement: HTMLElement,
	cardRect: DOMRect,
): [Point, Point] {
	const x =
		cardElement.getAttribute("data-side") === "left"
			? cardRect.right
			: cardRect.left;
	return [
		{ x, y: cardRect.top },
		{ x, y: cardRect.bottom },
	];
}

// Re-derives the triangle's base from the card's *current* rect on every
// call rather than a rect captured once when tracking started — the open
// card's bounds can keep changing after that (its CSS entrance transition,
// or content resizing as async data loads in).
export function isPointInsideCardCone(
	point: Point,
	apex: Point,
	cardElement: HTMLElement | null,
): boolean {
	if (!cardElement) return false;
	const [cornerA, cornerB] = getNearCardCorners(
		cardElement,
		cardElement.getBoundingClientRect(),
	);
	return isPointInTriangle(point, apex, cornerA, cornerB);
}

/**
 * Safe triangle: apex at the point the pointer left the trigger, base at
 * the card's near edge. Calls `onAbandon` the moment the pointer strays
 * outside that cone, or once the deadline elapses with the pointer still
 * "inside" it (it stopped moving, or events stopped arriving). Returns the
 * cleanup that stops tracking; the caller runs it when the pointer arrives
 * on the card or the card closes for another reason.
 */
export function trackSafeTriangle({
	apex,
	getCardElement,
	onAbandon,
	maxTrackMs = SAFE_TRIANGLE_MAX_TRACK_MS,
}: {
	apex: Point;
	getCardElement: () => HTMLElement | null;
	onAbandon: () => void;
	maxTrackMs?: number;
}): () => void {
	const handlePointerMove = (event: MouseEvent) => {
		const point = { x: event.clientX, y: event.clientY };
		if (isPointInsideCardCone(point, apex, getCardElement())) return;
		onAbandon();
	};
	document.addEventListener("mousemove", handlePointerMove);
	const deadlineTimer = setTimeout(onAbandon, maxTrackMs);
	return () => {
		document.removeEventListener("mousemove", handlePointerMove);
		clearTimeout(deadlineTimer);
	};
}
