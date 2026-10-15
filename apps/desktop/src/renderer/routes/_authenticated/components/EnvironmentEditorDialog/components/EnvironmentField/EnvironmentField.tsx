import { Label } from "@superset/ui/label";
import type { ReactNode } from "react";

interface EnvironmentFieldProps {
	htmlFor: string;
	label: ReactNode;
	hint?: ReactNode;
	children: ReactNode;
}

export function EnvironmentField({
	htmlFor,
	label,
	hint,
	children,
}: EnvironmentFieldProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label
				className="text-xs font-medium text-muted-foreground"
				htmlFor={htmlFor}
			>
				{label}
			</Label>
			{children}
			{hint && (
				<p className="text-xs leading-snug text-muted-foreground">{hint}</p>
			)}
		</div>
	);
}
