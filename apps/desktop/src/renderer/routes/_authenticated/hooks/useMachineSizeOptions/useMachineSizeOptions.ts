import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import {
	machineSizeSpec,
	OFFERED_MACHINE_SIZES,
	type OfferedMachineSize,
} from "@superset/shared/billing";

export interface MachineSizeOption {
	size: OfferedMachineSize;
	name: string;
	spec: string;
	usage: string;
}

export function useMachineSizeOptions(): MachineSizeOption[] {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	const names: Record<OfferedMachineSize, string> = {
		small: t({ message: "Small", context: "machine size" }),
		medium: t({ message: "Medium", context: "machine size" }),
		large: t({ message: "Large", context: "machine size" }),
	};

	return OFFERED_MACHINE_SIZES.map((size) => {
		const { vcpus, memoryGb, boxHoursPerHour } = machineSizeSpec(size);
		const vcpuCount = formatNumber(vcpus);
		const memory = formatNumber(memoryGb);
		return {
			size,
			name: names[size],
			spec: t({ message: `${vcpuCount} vCPU · ${memory} GB` }),
			usage: t({
				message: plural(boxHoursPerHour, {
					one: "Uses # box hour per hour",
					other: "Uses # box hours per hour",
				}),
			}),
		};
	});
}
