import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { SidebarSlide, type SidebarSlideMode } from "../SidebarSlide";
import { clampSideWidth } from "./utils/clampSideWidth";

interface WorkspaceSplitLayoutProps {
	mode: SidebarSlideMode;
	width: number | undefined;
	minWidth: number;
	maxWidth: number;
	defaultWidth: (containerWidth: number) => number;
	onWidthChange: (width: number) => void;
	onResizingChange: (isResizing: boolean) => void;
	onLayoutFrame?: () => void;
	keepMounted: boolean;
	durationMs?: number;
	side: ReactNode;
	children: ReactNode;
}

export function WorkspaceSplitLayout({
	mode,
	width,
	minWidth,
	maxWidth,
	defaultWidth,
	onWidthChange,
	onResizingChange,
	onLayoutFrame,
	keepMounted,
	durationMs,
	side,
	children,
}: WorkspaceSplitLayoutProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	useLayoutEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		setContainerWidth(element.clientWidth);
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setContainerWidth(entry.contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const clamped = clampSideWidth({
		width: width ?? defaultWidth(containerWidth),
		minWidth,
		maxWidth,
		containerWidth,
	});

	return (
		<div
			ref={containerRef}
			className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"
		>
			<div
				inert={mode === "expanded"}
				className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
			>
				{children}
			</div>
			<SidebarSlide
				mode={mode}
				width={clamped.width}
				onLayoutFrame={onLayoutFrame}
				keepMounted={keepMounted}
				durationMs={durationMs}
			>
				{(fill) => (
					<ResizablePanel
						disabled={fill}
						commitOnRelease
						width={clamped.width}
						onWidthChange={onWidthChange}
						onResizingChange={onResizingChange}
						minWidth={minWidth}
						maxWidth={clamped.maxWidth}
						handleSide="left"
						onDoubleClickHandle={() =>
							onWidthChange(defaultWidth(containerWidth))
						}
					>
						{side}
					</ResizablePanel>
				)}
			</SidebarSlide>
		</div>
	);
}
