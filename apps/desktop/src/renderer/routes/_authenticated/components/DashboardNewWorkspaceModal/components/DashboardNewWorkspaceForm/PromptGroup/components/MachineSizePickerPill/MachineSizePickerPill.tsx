import { useLingui } from "@lingui/react/macro";
import type { OfferedMachineSize } from "@superset/shared/billing";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { HiCheck, HiChevronUpDown } from "react-icons/hi2";
import { LuCpu } from "react-icons/lu";
import { useMachineSizeOptions } from "renderer/routes/_authenticated/hooks/useMachineSizeOptions";
import {
	FORM_PICKER_MENU_CLASS,
	FormPickerTrigger,
} from "../FormPickerTrigger";

interface MachineSizePickerPillProps {
	machineSize: OfferedMachineSize;
	onSelectMachineSize: (machineSize: OfferedMachineSize) => void;
}

export function MachineSizePickerPill({
	machineSize,
	onSelectMachineSize,
}: MachineSizePickerPillProps) {
	const { t } = useLingui();
	const options = useMachineSizeOptions();
	const selected = options.find((option) => option.size === machineSize);
	const label = selected?.name ?? machineSize;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<FormPickerTrigger
					aria-label={t({ message: `Machine size: ${label}` })}
					title={selected?.spec ?? label}
				>
					<LuCpu className="size-3 shrink-0" />
					<span className="truncate">{label}</span>
					<HiChevronUpDown className="size-3 shrink-0" />
				</FormPickerTrigger>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className={`w-64 ${FORM_PICKER_MENU_CLASS}`}
			>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.size}
						onSelect={() => onSelectMachineSize(option.size)}
						className="items-start gap-2"
					>
						<LuCpu className="mt-0.5 size-4 shrink-0" />
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="flex items-baseline gap-1.5">
								<span>{option.name}</span>
								<span className="text-xs text-muted-foreground">
									{option.spec}
								</span>
							</span>
							<span className="text-xs text-muted-foreground">
								{option.usage}
							</span>
						</span>
						{option.size === machineSize && (
							<HiCheck className="mt-0.5 size-4 shrink-0" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
