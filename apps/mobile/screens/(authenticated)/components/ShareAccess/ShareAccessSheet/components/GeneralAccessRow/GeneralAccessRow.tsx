import { Button } from "@expo/ui/swift-ui";
import { useLingui } from "@lingui/react/macro";
import type { ShareRoleOption } from "@superset/shared/sharing";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ValueMenu } from "../../../components/ValueMenu";
import { useChooseGeneralAccess } from "../../../hooks/useChooseGeneralAccess";
import type { GeneralAccess } from "../../../types";
import { useChangeGeneralRole } from "./hooks/useChangeGeneralRole";

export function GeneralAccessRow({
	general,
	roles,
	canManage,
}: {
	general: GeneralAccess;
	roles: ShareRoleOption[];
	canManage: boolean;
}) {
	const { t } = useLingui();
	const choose = useChooseGeneralAccess(general);
	const changeRole = useChangeGeneralRole(general);
	const current =
		general.options.find((option) => option.value === general.value) ??
		general.options[0];
	if (!current) return null;
	const role =
		general.value === "just_me"
			? undefined
			: general.role
				? (roles.find((option) => option.id === general.role?.value) ??
					roles[0])
				: roles.length === 1
					? roles[0]
					: undefined;

	return (
		<View className="min-h-14 flex-row items-center gap-3 py-2">
			{current.mark ? (
				<View className="bg-foreground size-9 shrink-0 items-center justify-center rounded-lg">
					<Text className="text-background text-sm font-semibold">
						{current.mark}
					</Text>
				</View>
			) : (
				<View className="bg-muted size-9 shrink-0 items-center justify-center rounded-lg">
					<Icon as={current.icon} className="text-foreground size-[18px]" />
				</View>
			)}
			<View className="min-w-0 flex-1 items-start">
				{canManage ? (
					<ValueMenu
						label={current.label}
						a11yLabel={t({ message: "Who can open it" })}
						tone="foreground"
						size={16}
						chevron="chevron.up.chevron.down"
					>
						{general.options.map((option) => (
							<Button
								key={option.value}
								label={option.label}
								systemImage={
									option.value === general.value ? "checkmark" : undefined
								}
								onPress={() => void choose(option.value)}
							/>
						))}
					</ValueMenu>
				) : (
					<Text className="text-base" numberOfLines={1}>
						{current.label}
					</Text>
				)}
			</View>
			{role ? (
				canManage && general.role && roles.length > 1 ? (
					<ValueMenu
						label={role.label}
						a11yLabel={t({ message: "What general access allows" })}
						tone="foreground"
						size={14}
						chevron="chevron.up.chevron.down"
						pill
					>
						{roles.map((option) => (
							<Button
								key={option.id}
								label={option.label}
								systemImage={option.id === role.id ? "checkmark" : undefined}
								onPress={() => void changeRole(option.id)}
							/>
						))}
					</ValueMenu>
				) : (
					<Text className="text-muted-foreground shrink-0 text-sm">
						{role.label}
					</Text>
				)
			) : null}
		</View>
	);
}
