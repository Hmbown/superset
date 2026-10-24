import { afterEach, describe, expect, test } from "bun:test";
import type { SidebarSlideMode } from "../SidebarSlide";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { act, cleanup, render } = await import("@testing-library/react");
const { WorkspaceSplitLayout } = await import("./WorkspaceSplitLayout");

afterEach(cleanup);

const settle = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 40)));

function renderLayout(initial: SidebarSlideMode) {
	const ui = (next: SidebarSlideMode) => (
		<WorkspaceSplitLayout
			mode={next}
			width={300}
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
	const result = render(ui(initial));
	return {
		...result,
		center: () => result.getByTestId("center").parentElement as HTMLElement,
		setMode: (next: SidebarSlideMode) => result.rerender(ui(next)),
	};
}

describe("WorkspaceSplitLayout", () => {
	test("the center has no hard minimum, so it can yield all its width", () => {
		const center = renderLayout("open").center();
		expect(center.className).toContain("min-w-0");
		expect(center.className).toContain("flex-1");
		expect(center.style.minWidth).toBe("");
	});

	test("the center stays mounted and is inert only while expanded", async () => {
		for (const from of ["closed", "open"] as const) {
			const layout = renderLayout(from);
			const node = layout.getByTestId("center");
			layout.setMode("expanded");
			expect(layout.center().hasAttribute("inert")).toBe(true);
			await settle();
			layout.setMode(from);
			expect(layout.center().hasAttribute("inert")).toBe(false);
			await settle();
			expect(layout.getByTestId("center")).toBe(node);
			layout.unmount();
		}
	});
});
