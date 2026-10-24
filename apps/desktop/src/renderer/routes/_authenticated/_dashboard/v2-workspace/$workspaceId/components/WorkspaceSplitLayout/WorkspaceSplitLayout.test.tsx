import { afterEach, describe, expect, test } from "bun:test";
import type { SidebarSlideMode } from "../SidebarSlide";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { act, cleanup, render } = await import("@testing-library/react");
const { WorkspaceSplitLayout } = await import("./WorkspaceSplitLayout");

afterEach(cleanup);

const CENTER_WIDTH = 640;

const settle = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 40)));

function renderLayout() {
	const ui = (next: SidebarSlideMode, width = 300) => (
		<WorkspaceSplitLayout
			mode={next}
			width={width}
			minWidth={200}
			maxWidth={Number.POSITIVE_INFINITY}
			defaultWidth={() => 300}
			onWidthChange={() => {}}
			onResizingChange={() => {}}
			keepMounted
			durationMs={1}
			side={<div data-testid="side">side</div>}
		>
			<div data-testid="center">center</div>
		</WorkspaceSplitLayout>
	);
	const result = render(ui("open"));
	const content = result.getByTestId("center").parentElement as HTMLElement;
	const center = content.parentElement as HTMLElement;
	center.getBoundingClientRect = () => ({ width: CENTER_WIDTH }) as DOMRect;
	const panel = () =>
		result.getByTestId("side").closest("[data-browser-layer]") as HTMLElement;
	return {
		...result,
		center,
		content,
		panel,
		setMode: (next: SidebarSlideMode, width?: number) =>
			result.rerender(ui(next, width)),
		isCollapsed: () =>
			parseFloat(center.style.minWidth) === 0 &&
			center.className.includes("w-0") &&
			center.hasAttribute("inert") &&
			content.style.width === `${CENTER_WIDTH}px`,
		isRestored: () =>
			center.style.minWidth === "320px" &&
			center.className.includes("flex-1") &&
			content.style.width === "",
	};
}

async function renderExpanded() {
	const layout = renderLayout();
	layout.setMode("expanded");
	await settle();
	return layout;
}

describe("WorkspaceSplitLayout", () => {
	test("collapses the center only once the slide settles in expanded", async () => {
		const layout = renderLayout();
		const node = layout.getByTestId("center");
		layout.setMode("expanded");
		expect(layout.isRestored()).toBe(true);
		await settle();
		expect(layout.isCollapsed()).toBe(true);
		expect(layout.center.className).toContain("invisible");
		expect(layout.getByTestId("center")).toBe(node);
	});

	test("restores the center before the exit slide starts", async () => {
		const layout = await renderExpanded();
		const node = layout.getByTestId("center");
		layout.setMode("open");
		expect(layout.panel().style.width).toBe("100%");
		expect(layout.panel().style.transitionDuration).toBe("0ms");
		expect(layout.isRestored()).toBe(true);
		await settle();
		expect(layout.isRestored()).toBe(true);
		expect(layout.getByTestId("center")).toBe(node);
	});

	test("stays collapsed when the split width changes while expanded", async () => {
		const layout = await renderExpanded();
		layout.setMode("expanded", 420);
		await settle();
		expect(layout.isCollapsed()).toBe(true);
	});

	test("a quick reversal settles in the matching state", async () => {
		const layout = renderLayout();
		layout.setMode("expanded");
		layout.setMode("open");
		await settle();
		expect(layout.isRestored()).toBe(true);
		layout.setMode("expanded");
		await settle();
		layout.setMode("open");
		layout.setMode("expanded");
		expect(layout.isRestored()).toBe(true);
		await settle();
		expect(layout.isCollapsed()).toBe(true);
	});
});
