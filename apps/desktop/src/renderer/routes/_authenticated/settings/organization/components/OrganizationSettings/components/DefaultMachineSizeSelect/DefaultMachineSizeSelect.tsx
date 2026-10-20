import { useLingui } from "@lingui/react/macro";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { toast } from "@superset/ui/sonner";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { useMachineSizeOptions } from "renderer/routes/_authenticated/hooks/useMachineSizeOptions";

interface DefaultMachineSizeSelectProps {
	id: string;
	organizationId: string;
	disabled: boolean;
}

export function DefaultMachineSizeSelect({
	id,
	organizationId,
	disabled,
}: DefaultMachineSizeSelectProps) {
	const { t } = useLingui();
	const utils = cloudTrpc.useUtils();
	const { options, defaultSize } = useMachineSizeOptions();

	async function handleChange(machineSize: string): Promise<void> {
		if (machineSize === defaultSize) return;
		try {
			await apiTrpcClient.organization.setDefaultMachineSize.mutate({
				id: organizationId,
				machineSize,
			});
			await utils.cloudWorkspace.machineSizes.invalidate();
			toast.success(t({ message: "Default machine size updated" }));
		} catch (error) {
			console.error(
				"[organization-settings] Default machine size update failed:",
				error,
			);
			toast.error(t({ message: "Failed to update default machine size" }));
		}
	}

	return (
		<Select
			value={defaultSize}
			onValueChange={handleChange}
			disabled={disabled}
		>
			<SelectTrigger id={id} size="sm" className="w-72">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.size} value={option.size}>
						{`${option.name} · ${option.spec}`}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
