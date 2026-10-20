import {
	Host,
	HStack,
	Button as SwiftUIButton,
	Image as SwiftUIImage,
	Text as SwiftUIText,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	buttonBorderShape,
	buttonStyle,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps } from "react";
import { useTheme } from "@/hooks/useTheme";
import { DOCK_CHIP_HEIGHT } from "./constants";

/** The padding .glass draws around its label, measured on iOS 26. */
const GLASS_PADDING = 7;

interface DockChipProps {
	label: string;
	count?: number;
	systemName?: NonNullable<ComponentProps<typeof SwiftUIImage>["systemName"]>;
	onPress: () => void;
}

/** Same native .glass button as the scroll-to-bottom button beside it. */
export function DockChip({ label, count, systemName, onPress }: DockChipProps) {
	const theme = useTheme();
	return (
		<Host matchContents colorScheme="dark">
			<SwiftUIButton
				onPress={onPress}
				modifiers={[
					buttonStyle("glass"),
					buttonBorderShape("capsule"),
					accessibilityLabel(
						count === undefined ? label : `${label}, ${count}`,
					),
				]}
			>
				<HStack
					spacing={8}
					modifiers={[
						frame({ height: DOCK_CHIP_HEIGHT - GLASS_PADDING * 2 }),
						padding({ horizontal: 4 }),
					]}
				>
					{systemName ? (
						<SwiftUIImage
							systemName={systemName}
							size={16}
							color={theme.mutedForeground}
						/>
					) : null}
					<SwiftUIText
						modifiers={[
							font({ size: 16 }),
							foregroundStyle(theme.foreground),
							lineLimit(1),
						]}
					>
						{label}
					</SwiftUIText>
					{count !== undefined ? (
						<SwiftUIText
							modifiers={[
								font({ size: 16 }),
								foregroundStyle(theme.mutedForeground),
							]}
						>
							{String(count)}
						</SwiftUIText>
					) : null}
				</HStack>
			</SwiftUIButton>
		</Host>
	);
}
