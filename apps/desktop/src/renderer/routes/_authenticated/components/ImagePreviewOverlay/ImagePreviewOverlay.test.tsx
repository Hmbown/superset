import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";

const reactActGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
const { cleanup, fireEvent, render, waitFor } = await import(
	"@testing-library/react"
);
const { toast } = await import("@superset/ui/sonner");
const { ImagePreviewOverlay } = await import("./ImagePreviewOverlay");

let toastError: ReturnType<typeof spyOn<typeof toast, "error">>;
beforeEach(() => {
	toastError = spyOn(toast, "error").mockImplementation(() => "");
});
afterEach(() => {
	cleanup();
	toastError.mockRestore();
});
afterAll(() => {
	reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

const SRC = "data:image/png;base64,iVBORw0KGgo=";

function renderOverlay(
	props: Partial<Parameters<typeof ImagePreviewOverlay>[0]> = {},
) {
	return render(
		<ImagePreviewOverlay
			filename="shot.png"
			onClose={mock(() => {})}
			onDownload={mock(async () => {})}
			open
			src={SRC}
			{...props}
		/>,
	);
}

const previous = { name: "Previous image" };
const next = { name: "Next image" };

describe("ImagePreviewOverlay", () => {
	test("steps with the edge buttons and disables them at the ends", () => {
		const onPrevious = mock(() => {});
		const onNext = mock(() => {});
		const view = renderOverlay({
			onNext,
			onPrevious,
			position: { index: 0, total: 3 },
		});
		expect(view.getByText("1 of 3")).toBeTruthy();
		const back = view.getByRole("button", previous) as HTMLButtonElement;
		expect(back.disabled).toBe(true);
		fireEvent.click(view.getByRole("button", next));
		expect(onNext).toHaveBeenCalledTimes(1);

		view.rerender(
			<ImagePreviewOverlay
				filename="shot.png"
				onClose={mock(() => {})}
				onDownload={mock(async () => {})}
				onNext={onNext}
				onPrevious={onPrevious}
				open
				position={{ index: 2, total: 3 }}
				src={SRC}
			/>,
		);
		expect(view.getByText("3 of 3")).toBeTruthy();
		const forward = view.getByRole("button", next) as HTMLButtonElement;
		expect(forward.disabled).toBe(true);
		fireEvent.click(view.getByRole("button", previous));
		expect(onPrevious).toHaveBeenCalledTimes(1);
	});

	test("hides the step buttons and the count for a single image", () => {
		const view = renderOverlay({
			onNext: mock(() => {}),
			onPrevious: mock(() => {}),
			position: { index: 0, total: 1 },
		});
		expect(view.queryByRole("button", previous)).toBeNull();
		expect(view.queryByRole("button", next)).toBeNull();
		expect(view.queryByText("1 of 1")).toBeNull();
	});

	test("arrow keys step, and stop at the ends", () => {
		const onPrevious = mock(() => {});
		const onNext = mock(() => {});
		renderOverlay({ onNext, onPrevious, position: { index: 1, total: 2 } });
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(onNext).not.toHaveBeenCalled();
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		expect(onPrevious).toHaveBeenCalledTimes(1);
	});

	test("arrow keys do not reach listeners under the overlay", () => {
		const underneath = mock(() => {});
		document.body.addEventListener("keydown", underneath);
		try {
			renderOverlay({
				onNext: mock(() => {}),
				onPrevious: mock(() => {}),
				position: { index: 0, total: 2 },
			});
			fireEvent.keyDown(document.body, { key: "ArrowRight" });
			expect(underneath).not.toHaveBeenCalled();
		} finally {
			document.body.removeEventListener("keydown", underneath);
		}
	});

	test("a successful copy shows a check", async () => {
		const onCopy = mock(async () => {});
		const view = renderOverlay({ onCopy });
		fireEvent.click(view.getByRole("button", { name: "Copy image" }));
		await waitFor(() => view.getByRole("button", { name: "Copied" }));
		expect(onCopy).toHaveBeenCalledTimes(1);
		expect(toastError).not.toHaveBeenCalled();
	});

	test("a failed copy keeps the copy button and shows a toast", async () => {
		const view = renderOverlay({
			onCopy: mock(async () => {
				throw new Error("clipboard busy");
			}),
		});
		fireEvent.click(view.getByRole("button", { name: "Copy image" }));
		await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
		expect(view.getByRole("button", { name: "Copy image" })).toBeTruthy();
		expect(view.queryByRole("button", { name: "Copied" })).toBeNull();
	});

	test("⌘C copies unless text is selected", async () => {
		const onCopy = mock(async () => {});
		const view = renderOverlay({ onCopy });
		fireEvent.keyDown(window, { key: "c", metaKey: true });
		await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));

		const text = document.createElement("p");
		text.textContent = "selected words";
		document.body.appendChild(text);
		const range = document.createRange();
		range.selectNodeContents(text);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		try {
			expect(selection?.toString()).toBe("selected words");
			fireEvent.keyDown(window, { key: "c", metaKey: true });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(onCopy).toHaveBeenCalledTimes(1);
		} finally {
			selection?.removeAllRanges();
			text.remove();
		}
		void view;
	});

	test("without a source it shows the fallback and disables copy", () => {
		const view = renderOverlay({
			fallback: "Couldn't load shot.png",
			onCopy: mock(async () => {}),
			src: null,
		});
		expect(view.getByText("Couldn't load shot.png")).toBeTruthy();
		expect(view.queryByRole("img")).toBeNull();
		const copy = view.getByRole("button", {
			name: "Copy image",
		}) as HTMLButtonElement;
		expect(copy.disabled).toBe(true);
	});

	test("an image that cannot be decoded says so and disables copy", () => {
		const view = renderOverlay({ onCopy: mock(async () => {}) });
		fireEvent.error(view.getByRole("img"));
		expect(view.queryByRole("img")).toBeNull();
		expect(view.getByText("Couldn't load shot.png")).toBeTruthy();
		const copy = view.getByRole("button", {
			name: "Copy image",
		}) as HTMLButtonElement;
		expect(copy.disabled).toBe(true);

		view.rerender(
			<ImagePreviewOverlay
				filename="next.png"
				onClose={mock(() => {})}
				onDownload={mock(async () => {})}
				open
				src="data:image/png;base64,AAAA"
			/>,
		);
		expect(view.getByRole("img").getAttribute("alt")).toBe("next.png");
	});

	test("focus moves into the dialog and back out on close", () => {
		const opener = document.createElement("button");
		document.body.appendChild(opener);
		opener.focus();
		const onClose = mock(() => {});
		const view = renderOverlay({ onClose });
		expect(document.activeElement).toBe(view.getByRole("dialog"));
		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);

		view.rerender(
			<ImagePreviewOverlay
				filename="shot.png"
				onClose={onClose}
				onDownload={mock(async () => {})}
				open={false}
				src={SRC}
			/>,
		);
		expect(document.activeElement).toBe(opener);
		opener.remove();
	});
});
