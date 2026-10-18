import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { GranteeAvatar } from "../../../components/GranteeAvatar";
import { SelectionTick } from "./components/SelectionTick";

export function SuggestionRow({
	icon,
	dashed,
	person,
	title,
	detail,
	trailing,
	error,
	selected,
	accessory,
	disabled,
	onPress,
}: {
	icon?: LucideIcon;
	dashed?: boolean;
	person?: { name: string; image: string | null };
	title: string;
	detail?: string;
	trailing?: string;
	error?: string;
	/** Shows a tick circle, filled when true. */
	selected?: boolean;
	/** Shown before the tick, such as the pick's role. */
	accessory?: ReactNode;
	disabled?: boolean;
	onPress?: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{
				disabled: Boolean(disabled),
				selected: Boolean(selected),
			}}
			disabled={disabled || !onPress}
			onPress={onPress}
			className={cn(
				"min-h-14 flex-row items-center gap-3 py-2 active:opacity-60",
				disabled && "opacity-55",
			)}
		>
			{person ? (
				<GranteeAvatar kind="person" name={person.name} image={person.image} />
			) : icon ? (
				<GranteeAvatar kind="icon" icon={icon} dashed={dashed} />
			) : null}
			<View className="min-w-0 flex-1">
				<Text className="text-base" numberOfLines={1}>
					{title}
				</Text>
				{detail ? (
					<Text className="text-muted-foreground text-sm" numberOfLines={1}>
						{detail}
					</Text>
				) : null}
				{error ? (
					<Text className="text-destructive text-xs">{error}</Text>
				) : null}
			</View>
			{trailing ? (
				<Text className="text-muted-foreground shrink-0 text-xs">
					{trailing}
				</Text>
			) : null}
			{accessory}
			{selected === undefined ? null : <SelectionTick selected={selected} />}
		</Pressable>
	);
}
