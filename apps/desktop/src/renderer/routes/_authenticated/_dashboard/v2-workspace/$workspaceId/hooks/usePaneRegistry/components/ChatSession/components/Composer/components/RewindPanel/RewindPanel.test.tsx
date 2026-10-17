import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { RewindPanel } from "./RewindPanel";

afterEach(cleanup);

describe("RewindPanel", () => {
	it("says what this agent cannot rewind before the messages to pick from", () => {
		const picked: string[] = [];
		const view = render(
			<RewindPanel
				notes={["Pi can't rewind its own history."]}
				points={[{ itemId: "u1", text: "add a test", startedAtMs: 0 }]}
				onPick={(point) => picked.push(point.itemId)}
			/>,
		);
		expect(view.getByText("Pi can't rewind its own history.")).toBeTruthy();
		fireEvent.click(view.getByText("add a test"));
		expect(picked).toEqual(["u1"]);
	});
});
