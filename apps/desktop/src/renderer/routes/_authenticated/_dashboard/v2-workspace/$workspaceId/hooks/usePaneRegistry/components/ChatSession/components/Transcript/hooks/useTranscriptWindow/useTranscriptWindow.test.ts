import { afterEach, expect, test } from "bun:test";
import type { TranscriptRow } from "../../utils/transcriptRows";
import { rowHeightsFor } from "./utils/rowHeights";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const { cleanup, renderHook } = await import("@testing-library/react");
const { useTranscriptWindow } = await import("./useTranscriptWindow");

afterEach(cleanup);

function rows(count: number): TranscriptRow[] {
	return Array.from({ length: count }, (_, index) => ({
		kind: "item",
		key: `row-${index}`,
		groupStart: true,
		item: {
			id: `item-${index}`,
			kind: "user_message",
			clientId: `client-${index}`,
			startedAtMs: index,
			content: [],
		},
	}));
}

const observeRow = () => () => {};

function renderWindow(
	initial: { rows: TranscriptRow[]; pinned?: (string | null)[] },
	sessionId = crypto.randomUUID(),
) {
	return renderHook(
		({ rows, pinned }: { rows: TranscriptRow[]; pinned?: (string | null)[] }) =>
			useTranscriptWindow({
				rows,
				viewport: null,
				sessionId,
				pinnedRowKeys: pinned ?? [],
				observeRow,
			}),
		{ initialProps: initial },
	);
}

test("mounts the last 40 rows and keeps them when more rows stream in", () => {
	const { result, rerender } = renderWindow({ rows: rows(100) });
	expect(result.current.startIndex).toBe(60);

	rerender({ rows: rows(110) });
	expect(result.current.startIndex).toBe(60);
});

test("extends the window to a pinned row and keeps it after the pin clears", () => {
	const { result, rerender } = renderWindow({ rows: rows(100) });
	rerender({ rows: rows(100), pinned: ["row-10"] });
	expect(result.current.startIndex).toBe(10);

	rerender({ rows: rows(100), pinned: [] });
	expect(result.current.startIndex).toBe(10);
});

test("sizes the spacer from the heights measured for this session", () => {
	const sessionId = crypto.randomUUID();
	const heights = rowHeightsFor(sessionId);
	for (let index = 0; index < 60; index++) heights.set(`row-${index}`, 50);

	const { result } = renderWindow({ rows: rows(100) }, sessionId);
	expect(result.current.spacerHeight).toBe(60 * 50);
});
