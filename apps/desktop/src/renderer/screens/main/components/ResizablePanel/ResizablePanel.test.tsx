import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { ResizablePanel } from "./ResizablePanel";

afterEach(cleanup);

const nextFrame = () =>
	act(
		() =>
			new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
	);

describe("ResizablePanel", () => {
	test("keeps a drag when the width changes underneath it, and saves it on release", async () => {
		const onWidthChange = mock((_width: number) => {});
		const props = {
			onWidthChange,
			onResizingChange: () => {},
			minWidth: 100,
			maxWidth: 800,
			handleSide: "right" as const,
			commitOnRelease: true,
			children: null,
		};
		const view = render(
			<ResizablePanel {...props} width={300} isResizing={false} />,
		);
		const handle = view.getByRole("separator");
		fireEvent.mouseDown(handle, { clientX: 0 });
		view.rerender(<ResizablePanel {...props} width={300} isResizing />);
		fireEvent.mouseMove(document, { clientX: 100 });
		await nextFrame();
		expect(handle.getAttribute("aria-valuenow")).toBe("400");

		view.rerender(<ResizablePanel {...props} width={320} isResizing />);
		expect(handle.getAttribute("aria-valuenow")).toBe("400");

		fireEvent.mouseUp(document);
		expect(onWidthChange).toHaveBeenCalledWith(400);
	});

	test("eases to the width set by a double-click, but never while dragging", async () => {
		const props = {
			onWidthChange: () => {},
			onResizingChange: () => {},
			minWidth: 100,
			maxWidth: 800,
			handleSide: "right" as const,
			onDoubleClickHandle: () => {},
			resetDurationMs: 1,
			children: null,
		};
		const view = render(
			<ResizablePanel {...props} width={300} isResizing={false} />,
		);
		const handle = view.getByRole("separator");
		const panel = view.container.firstElementChild as HTMLElement;
		expect(panel.className).not.toContain("transition-[width]");

		fireEvent.doubleClick(handle);
		expect(panel.className).toContain("transition-[width]");
		expect(panel.style.transitionDuration).toBe("1ms");
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
		expect(panel.className).not.toContain("transition-[width]");

		fireEvent.doubleClick(handle);
		view.rerender(<ResizablePanel {...props} width={300} isResizing />);
		expect(panel.className).not.toContain("transition-[width]");
	});
});
