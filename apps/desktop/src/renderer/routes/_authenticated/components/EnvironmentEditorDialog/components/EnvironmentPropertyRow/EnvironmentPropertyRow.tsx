import { Label } from "@superset/ui/label";
import type { ReactNode } from "react";

interface EnvironmentPropertyRowProps {
	htmlFor: string;
	label: ReactNode;
	children: ReactNode;
}

/** One line of the editor's property list: a muted label, then the control. */
export function EnvironmentPropertyRow({
	htmlFor,
	label,
	children,
}: EnvironmentPropertyRowProps) {
	return (
		<div className="flex h-10 items-center">
			<Label
				className="w-28 shrink-0 pl-3 text-xs font-normal text-muted-foreground"
				htmlFor={htmlFor}
			>
				{label}
			</Label>
			<div className="flex min-w-0 flex-1 items-center">{children}</div>
		</div>
	);
}
