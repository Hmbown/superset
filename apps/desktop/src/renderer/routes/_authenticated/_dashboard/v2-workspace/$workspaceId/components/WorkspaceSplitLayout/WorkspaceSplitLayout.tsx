import { cn } from "@superset/ui/utils";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { SidebarSlide, type SidebarSlideMode } from "../SidebarSlide";
import { clampSideWidth, MIN_CENTER_WIDTH } from "./utils/clampSideWidth";

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
	const centerRef = useRef<HTMLDivElement>(null);
	const [collapsedCenterWidth, setCollapsedCenterWidth] = useState<
		number | null
	>(null);
	const collapsed = collapsedCenterWidth !== null;
	const onRestChange = useCallback((rest: SidebarSlideMode | null) => {
		setCollapsedCenterWidth(
			rest === "expanded"
				? (centerRef.current?.getBoundingClientRect().width ?? 0)
				: null,
		);
	}, []);
	const onLayoutFrameRef = useRef(onLayoutFrame);
	onLayoutFrameRef.current = onLayoutFrame;
	useEffect(() => {
		if (collapsed) onLayoutFrameRef.current?.();
	}, [collapsed]);
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
				ref={centerRef}
				inert={mode === "expanded" || collapsed}
				className={cn(
					"flex min-h-0",
					collapsed ? "invisible w-0 flex-none overflow-hidden" : "flex-1",
				)}
				style={{ minWidth: collapsed ? 0 : MIN_CENTER_WIDTH }}
			>
				{/* Panes keep a min width, so a 0px center would still resize terminals. */}
				<div
					className={cn(
						"flex min-h-0",
						collapsed ? "flex-none" : "min-w-0 flex-1",
					)}
					style={{ width: collapsed ? collapsedCenterWidth : undefined }}
				>
					{children}
				</div>
			</div>
			<SidebarSlide
				mode={mode}
				width={clamped.width}
				onLayoutFrame={onLayoutFrame}
				onRestChange={onRestChange}
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
