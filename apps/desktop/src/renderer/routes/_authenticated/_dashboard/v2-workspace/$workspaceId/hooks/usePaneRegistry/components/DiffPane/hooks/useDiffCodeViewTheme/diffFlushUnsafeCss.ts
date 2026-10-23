// Appended after diffCardUnsafeCss for a narrow pane: the same files without
// the card frame, edge to edge, with each header's top border as the divider.
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
	[data-diff] {
		border: none;
		border-radius: 0;
		box-shadow: none;
	}
`;
