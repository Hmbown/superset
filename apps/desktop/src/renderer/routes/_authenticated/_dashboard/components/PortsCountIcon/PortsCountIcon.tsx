import { LuRadioTower } from "react-icons/lu";

const MAX_BADGE_COUNT = 9;

interface PortsCountIconProps {
	count: number;
}

export function PortsCountIcon({ count }: PortsCountIconProps) {
	return (
		<span className="relative flex size-5 items-center justify-center">
			<LuRadioTower className="size-3.5" strokeWidth={1.75} />
			<span
				className="absolute -top-0.5 -right-[3px] size-[11px] rounded-full text-center leading-[11px] bg-muted-foreground font-bold tracking-[-0.02em] text-background tabular-nums ring-[1.5px] ring-sidebar dark:ring-[color-mix(in_oklab,var(--muted)_35%,var(--background))]"
				style={{ fontSize: count > MAX_BADGE_COUNT ? 6 : 7.5 }}
			>
				{count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count}
			</span>
		</span>
	);
}
