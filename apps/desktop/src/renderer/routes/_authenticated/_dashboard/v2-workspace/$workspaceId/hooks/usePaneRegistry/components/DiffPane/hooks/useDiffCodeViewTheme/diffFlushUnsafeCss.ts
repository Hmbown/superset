// Appended after diffCardUnsafeCss for a narrow pane: the same files without
// the card frame, edge to edge, with each header's top border as the divider.
// The header height must match FLUSH_DIFF_HEADER_HEIGHT, which CodeView lays
// items out with.
export const FLUSH_DIFF_HEADER_HEIGHT = 32;

export const diffFlushUnsafeCss = `
	[data-diffs-header='default'],
	[data-diffs-header='default'][data-sticky],
	[data-diffs-header='default']:not(:has(~ [data-diff], ~ [data-code], ~ [data-file])) {
		border-left: none;
		border-right: none;
		border-bottom: none;
		border-radius: 0;
		box-shadow: none;
	}
	[data-diffs-header='default'] {
		min-height: ${FLUSH_DIFF_HEADER_HEIGHT}px;
		height: ${FLUSH_DIFF_HEADER_HEIGHT}px;
	}
	[data-diffs-header='default'] [data-additions-count],
	[data-diffs-header='default'] [data-deletions-count] {
		font-family: inherit;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	[data-diff] {
		border: none;
		border-radius: 0;
		box-shadow: none;
	}
`;
