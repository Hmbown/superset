import { Trans } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import type { RewindPoint } from "../../../../utils/rewindTimeline";

export function RewindPanel({
	notes,
	points,
	onPick,
}: {
	notes: string[];
	points: RewindPoint[];
	onPick: (point: RewindPoint) => void;
}) {
	const noteList =
		notes.length > 0 ? (
			<div className="mx-3 mb-1 flex flex-col gap-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-muted-foreground text-xs">
				{notes.map((note) => (
					<p key={note}>{note}</p>
				))}
			</div>
		) : null;
	if (points.length === 0) {
		return (
			<div className="py-1">
				{noteList}
				<p className="px-3 py-2 text-muted-foreground text-xs">
					<Trans>There are no messages to rewind to yet.</Trans>
				</p>
			</div>
		);
	}
	const now = Date.now();
	return (
		<div className="flex max-h-72 flex-col overflow-y-auto py-1">
			{noteList}
			<p className="px-3 pb-1 text-muted-foreground text-xs">
				<Trans>
					Pick a message. The chat goes back to just before it, and the message
					returns to the composer.
				</Trans>
			</p>
			{points.map((point) => (
				<button
					className="flex items-baseline gap-3 rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
					key={point.itemId}
					onClick={() => onPick(point)}
					type="button"
				>
					<span className="min-w-0 flex-1 truncate">{point.text}</span>
					<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
						{formatCompactRelativeTime(point.startedAtMs, now)}
					</span>
				</button>
			))}
		</div>
	);
}
