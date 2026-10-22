import { beforeEach, describe, expect, test } from "bun:test";
import {
	lastActiveChatComposer,
	useChatComposerStore,
} from "./chatComposerStore";

const target = () => ({ addFiles: () => {} });

describe("lastActiveChatComposer", () => {
	beforeEach(() => useChatComposerStore.setState({ composers: {} }));

	test("picks the composer used last in the workspace", () => {
		const a = target();
		const b = target();
		const other = target();
		const store = useChatComposerStore.getState();
		store.register("a", "ws1", a);
		store.register("b", "ws1", b);
		store.register("other", "ws2", other);
		useChatComposerStore.setState((state) => ({
			composers: {
				...state.composers,
				a: { ...state.composers.a, lastActiveAt: 2 },
				b: { ...state.composers.b, lastActiveAt: 1 },
				other: { ...state.composers.other, lastActiveAt: 3 },
			},
		}));
		expect(
			lastActiveChatComposer(useChatComposerStore.getState().composers, "ws1"),
		).toBe(a);

		store.unregister("a");
		expect(
			lastActiveChatComposer(useChatComposerStore.getState().composers, "ws1"),
		).toBe(b);
		expect(
			lastActiveChatComposer(useChatComposerStore.getState().composers, "ws3"),
		).toBeNull();
	});
});
