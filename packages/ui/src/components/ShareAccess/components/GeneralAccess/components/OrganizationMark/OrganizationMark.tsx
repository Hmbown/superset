import { getInitials } from "@superset/shared/names";

/** The organization's initial, standing in for its logo. */
export function OrganizationMark({ name }: { name: string }) {
	return (
		<span className="grid size-full place-items-center rounded-md bg-foreground font-semibold text-[11px] text-background">
			{getInitials(name).slice(0, 1) || "?"}
		</span>
	);
}
