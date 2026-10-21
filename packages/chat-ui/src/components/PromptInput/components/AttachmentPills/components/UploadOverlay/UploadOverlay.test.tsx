import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const alreadyRegistered = GlobalRegistrator.isRegistered;
if (!alreadyRegistered) GlobalRegistrator.register();
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { cleanup, render } = await import("@testing-library/react");
const { UploadOverlay } = await import("./UploadOverlay");

afterEach(() => cleanup());
afterAll(async () => {
	if (!alreadyRegistered) await GlobalRegistrator.unregister();
});

describe("UploadOverlay", () => {
	test("spins while pending, warns with the message on error, and hides otherwise", () => {
		const { container, rerender } = render(
			<UploadOverlay upload={{ state: "pending" }} />,
		);
		expect(container.querySelector(".animate-spin")).toBeTruthy();

		rerender(<UploadOverlay upload={{ state: "error", message: "too big" }} />);
		expect(container.querySelector('[title="too big"]')).toBeTruthy();
		expect(container.querySelector(".animate-spin")).toBeNull();

		rerender(<UploadOverlay upload={undefined} />);
		expect(container.firstChild).toBeNull();
	});
});
