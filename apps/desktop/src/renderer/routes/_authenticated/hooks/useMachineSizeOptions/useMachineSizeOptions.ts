import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import {
	DEFAULT_MACHINE_SIZE_CONFIG,
	machineSpec,
} from "@superset/shared/billing";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { cloudTrpc } from "renderer/lib/cloud-trpc";

export interface MachineSizeOption {
	size: string;
	name: string;
	spec: string;
	usage: string;
}

const FALLBACK = {
	defaultSize: DEFAULT_MACHINE_SIZE_CONFIG.defaultSize,
	sizes: Object.entries(DEFAULT_MACHINE_SIZE_CONFIG.sizes).map(
		([name, vcpus]) => ({ name, ...machineSpec(vcpus) }),
	),
};

export function useMachineSizeOptions(): {
	options: MachineSizeOption[];
	defaultSize: string;
} {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	const organizationId = useActiveOrganizationId();
	const { data } = cloudTrpc.cloudWorkspace.machineSizes.useQuery(
		{ organizationId: organizationId ?? "" },
		{ enabled: Boolean(organizationId) },
	);
	const config = data ?? FALLBACK;
	const names: Record<string, string> = {
		small: t({ message: "Small", context: "machine size" }),
		medium: t({ message: "Medium", context: "machine size" }),
		large: t({ message: "Large", context: "machine size" }),
	};

	return {
		defaultSize: config.defaultSize,
		options: config.sizes.map(({ name, vcpus, memoryGb, boxHoursPerHour }) => {
			const vcpuCount = formatNumber(vcpus);
			const memory = formatNumber(memoryGb);
			return {
				size: name,
				name: names[name] ?? name,
				spec: t({ message: `${vcpuCount} vCPU · ${memory} GB` }),
				usage: t({
					message: plural(boxHoursPerHour, {
						one: "Uses # box hour per hour",
						other: "Uses # box hours per hour",
					}),
				}),
			};
		}),
	};
}
