import { Host, HStack, Image, Menu, Text } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	background,
	clipShape,
	disabled as disabledModifier,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";

/**
 * A native pull-down menu anchored to its trigger: a label with a chevron, or
 * an ellipsis when `label` is omitted. The children are `@expo/ui/swift-ui`
 * `Button`, `Section` and `Divider` elements.
 */
export function ValueMenu({
	label,
	a11yLabel,
	tone = "muted",
	size = 13,
	weight = "regular",
	chevron = "chevron.down",
	pill = false,
	disabled = false,
	children,
}: {
	label?: string;
	a11yLabel: string;
	tone?: "muted" | "foreground";
	size?: number;
	weight?: "regular" | "medium" | "semibold";
	chevron?: "chevron.down" | "chevron.right" | "chevron.up.chevron.down";
	/** Draws the label on a filled capsule, like a button. */
	pill?: boolean;
	disabled?: boolean;
	children: ReactNode;
}) {
	const theme = useTheme();
	const color = tone === "muted" ? theme.mutedForeground : theme.foreground;
	return (
		<Host matchContents>
			<Menu
				label={
					label === undefined ? (
						<Image
							systemName="ellipsis"
							size={17}
							color={theme.mutedForeground}
							modifiers={[frame({ width: 36, height: 36 })]}
						/>
					) : (
						<HStack
							spacing={4}
							modifiers={
								pill
									? [
											padding({ horizontal: 11, vertical: 6 }),
											background(theme.muted),
											clipShape("capsule"),
										]
									: []
							}
						>
							<Text
								modifiers={[
									font({ size, weight }),
									foregroundStyle(color),
									lineLimit(1),
								]}
							>
								{label}
							</Text>
							<Image
								systemName={chevron}
								size={size - 4}
								color={theme.mutedForeground}
							/>
						</HStack>
					)
				}
				modifiers={[accessibilityLabel(a11yLabel), disabledModifier(disabled)]}
			>
				{children}
			</Menu>
		</Host>
	);
}
