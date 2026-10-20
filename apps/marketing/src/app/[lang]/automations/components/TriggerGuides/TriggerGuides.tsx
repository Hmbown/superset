import { Trans, useLingui } from "@lingui/react/macro";
import { COMPANY } from "@superset/shared/constants";
import { ArrowUpRight } from "lucide-react";
import { TRIGGER_GUIDES } from "./constants";

export function TriggerGuides() {
	const { t } = useLingui();

	return (
		<div className="mt-8">
			<p className="text-muted-foreground text-sm">
				<Trans>Start from a guide:</Trans>
			</p>
			<ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
				{TRIGGER_GUIDES.map((guide) => (
					<li key={guide.path}>
						<a
							href={`${COMPANY.DOCS_URL}${guide.path}`}
							className="inline-flex items-center gap-1.5 text-foreground text-sm transition-colors hover:text-muted-foreground"
						>
							{t(guide.title)}
							<ArrowUpRight className="size-3.5" />
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}
