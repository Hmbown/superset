import { useLingui } from "@lingui/react/macro";
import Image from "next/image";
import { TRIGGER_SOURCES, type TriggerSource } from "./constants";

function SourceIcon({ icon }: { icon: TriggerSource["icon"] }) {
	return (
		<span
			aria-hidden="true"
			className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground"
		>
			{"image" in icon ? (
				<Image src={icon.image} alt="" width={18} height={18} />
			) : (
				<icon.glyph style={{ width: 18, height: 18, color: icon.color }} />
			)}
		</span>
	);
}

export function TriggerSources() {
	const { t } = useLingui();

	return (
		<ul className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
			{TRIGGER_SOURCES.map((source) => (
				<li key={source.id} className="bg-background p-5">
					<div className="flex items-center gap-3">
						<SourceIcon icon={source.icon} />
						<span className="font-medium text-foreground">
							{typeof source.name === "string" ? source.name : t(source.name)}
						</span>
					</div>
					<ul className="mt-4 space-y-1.5 text-muted-foreground text-sm">
						{source.events.map((event) => (
							<li key={event.id}>{t(event)}</li>
						))}
					</ul>
					{source.note ? (
						<p className="mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							{t(source.note)}
						</p>
					) : null}
				</li>
			))}
		</ul>
	);
}
