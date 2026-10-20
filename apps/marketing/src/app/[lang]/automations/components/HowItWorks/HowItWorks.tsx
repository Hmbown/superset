import { Trans } from "@lingui/react/macro";
import { AutomationWindow } from "./components/AutomationWindow";
import { ReviewCard } from "./components/ReviewCard";
import { TriggerSources } from "./components/TriggerSources";

export function HowItWorks() {
	return (
		<div className="mt-12 grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
			<div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
				<p>
					<Trans>
						You write a prompt and add triggers. A trigger can be a schedule, an
						event from one of your tools, or a call to the automation's webhook.
					</Trans>
				</p>
				<p>
					<Trans>
						When a trigger fires, the Mac you picked opens a new workspace and
						the agent starts on the prompt. If an event started the run, the
						agent gets the event too, so it knows which issue or pull request to
						look at.
					</Trans>
				</p>
				<p>
					<Trans>
						You open the run to see what changed, and reply if you want more.
					</Trans>
				</p>
				<TriggerSources />
			</div>
			<div
				aria-hidden="true"
				className="relative overflow-hidden border border-border bg-[radial-gradient(ellipse_at_30%_20%,rgba(232,128,74,0.08),transparent_60%)] px-4 pt-6 pb-48 sm:p-10 sm:pb-40"
			>
				<AutomationWindow />
				<ReviewCard />
			</div>
		</div>
	);
}
