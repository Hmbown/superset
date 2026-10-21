/** The part of the spacer that is above the viewport's bottom edge, in px. */
export function trimmedSpacerHeight({
	clientHeight,
	scrollHeight,
	scrollTop,
	spacerHeight,
}: {
	clientHeight: number;
	scrollHeight: number;
	scrollTop: number;
	spacerHeight: number;
}): number {
	const contentHeight = scrollHeight - spacerHeight;
	const visible = Math.ceil(scrollTop + clientHeight - contentHeight);
	return Math.min(spacerHeight, Math.max(0, visible));
}
