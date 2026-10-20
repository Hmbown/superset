import { Trans } from "@lingui/react/macro";
import { Bot, Clock, Folder, Laptop, Play } from "lucide-react";
import { SiSentry } from "react-icons/si";
import { SentenceChip } from "./components/SentenceChip";

const LABEL =
	"font-mono text-[10px] text-muted-foreground uppercase tracking-widest";
const CHIP =
	"flex items-center gap-1.5 rounded-md border border-border px-2 py-1";

export function AutomationWindow() {
	return (
		<div className="overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
			<div className="flex h-10 items-center gap-2 border-border border-b px-3 text-xs">
				<span className="truncate font-medium text-foreground">
					<Trans>Launch watch</Trans>
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
			<div className="space-y-5 px-4 pt-4 pb-8 text-sm sm:px-6">
				<div>
					<p className={LABEL}>
						<Trans>Instructions</Trans>
					</p>
					<p className="mt-1 text-foreground leading-relaxed">
						<Trans>
							We released v2.0 today. Check for new errors and bug reports since
							the release. Fix what you can in draft pull requests and list the
							rest.
						</Trans>
					</p>
				</div>
				<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
					<span className={CHIP}>
						<Laptop className="size-3.5" />
						MacBook Pro
					</span>
					<span className={CHIP}>
						<Folder className="size-3.5" />
						superset
					</span>
					<span className={CHIP}>
						<Bot className="size-3.5" />
						claude
					</span>
				</div>
				<div>
					<p className={LABEL}>
						<Trans>Triggers</Trans>
					</p>
					<div className="mt-2 divide-y divide-border rounded-md border border-border text-muted-foreground text-xs">
						<div className="flex items-center gap-2 px-3 py-2">
							<Clock className="size-3.5 shrink-0" />
							<span className="text-foreground">
								<Trans>Every hour</Trans>
							</span>
							<span className="ml-auto hidden sm:inline">
								<Trans>Next run in 20 minutes</Trans>
							</span>
						</div>
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5">
							<SiSentry className="size-3.5 shrink-0" />
							<Trans>
								Sentry issue created in <SentenceChip>web</SentenceChip> with
								level <SentenceChip>Error</SentenceChip>
							</Trans>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
