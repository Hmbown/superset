import { Trans } from "@lingui/react/macro";
import { Clock, Play, Plus } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { SiSentry } from "react-icons/si";
import { RunStatusDot } from "../RunStatusDot";
import { SentenceChip } from "./components/SentenceChip";

const ROW =
	"flex min-h-10 flex-wrap items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[13px]";
const ICON = "mr-1.5 size-4 shrink-0 text-muted-foreground";

export function TriggersCard() {
	return (
		<div
			aria-hidden="true"
			className="mt-12 border border-border bg-[radial-gradient(ellipse_at_70%_20%,rgba(232,128,74,0.08),transparent_60%)] p-3 sm:p-10"
		>
			<div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
				<div className="flex h-10 items-center gap-2 border-border border-b px-3 text-xs">
					<span className="truncate font-medium text-foreground">
						<Trans>PR review</Trans>
					</span>
					<span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
						<span className="flex h-3.5 w-6 items-center justify-end rounded-full bg-emerald-500 p-0.5">
							<span className="size-2.5 rounded-full bg-white" />
						</span>
						<span className="hidden sm:inline">
							<Trans>Active</Trans>
						</span>
					</span>
					<span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border border-border px-2 py-0.5 text-muted-foreground">
						<Play className="size-3" />
						<Trans>Run now</Trans>
					</span>
				</div>

				<div className="px-3 pt-4 pb-3 sm:px-5">
					<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
						<Trans>Triggers</Trans>
					</p>
					<div className="mt-2 rounded-[12px] bg-foreground/[0.04] p-1 text-muted-foreground">
						<div className={ROW}>
							<FaGithub className={ICON} />
							<Trans>
								Review requested from <SentenceChip>Me</SentenceChip> in{" "}
								<SentenceChip>acme/web</SentenceChip> by{" "}
								<SentenceChip>Anyone</SentenceChip>
							</Trans>
						</div>
						<div className={ROW}>
							<SiSentry className={ICON} />
							<Trans>
								Sentry issue created in <SentenceChip>web</SentenceChip> with
								level <SentenceChip>Error</SentenceChip>
							</Trans>
						</div>
						<div className={ROW}>
							<Clock className={ICON} />
							<Trans>
								Every day at <SentenceChip>9:00 AM</SentenceChip>
							</Trans>
							<span className="ml-auto hidden text-muted-foreground/70 sm:inline">
								<Trans>Next run in 14h</Trans>
							</span>
						</div>
						<div className="mx-2 my-1 border-border/60 border-t" />
						<div className={ROW}>
							<Plus className="size-4" />
							<Trans>Add Trigger</Trans>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2 border-border border-t px-3 py-2.5 text-xs sm:px-5">
					<RunStatusDot status="created" />
					<span className="truncate text-foreground">
						<Trans>Review requested on acme/web #482</Trans>
					</span>
					<span className="ml-auto shrink-0 text-muted-foreground">
						<Trans>created · 2m ago</Trans>
					</span>
				</div>
			</div>
		</div>
	);
}
