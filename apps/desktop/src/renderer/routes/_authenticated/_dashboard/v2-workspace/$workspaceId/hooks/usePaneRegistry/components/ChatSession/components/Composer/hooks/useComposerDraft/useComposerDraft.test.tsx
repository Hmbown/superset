import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { appendPastedText } from "@superset/chat/core";
import {
	type ComposerDraft,
	draftFromText,
	EMPTY_DRAFT,
} from "@superset/chat-ui/PromptInput";

const { act, cleanup, renderHook } = await import("@testing-library/react");
const {
	parseStoredDraft,
	prependToDraft,
	takeRecoveredDraft,
	useComposerDraft,
} = await import("./useComposerDraft");

const draft = (text: string, pastedTexts: string[] = []): ComposerDraft => ({
	...EMPTY_DRAFT,
	text,
	pastedTexts,
});
const stored = (key: string) =>
	parseStoredDraft(window.localStorage.getItem(key) ?? "");

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);
test("a composer mounted before the save delay reads text typed into the one it replaces", () => {
	const connecting = renderHook(() =>
		useComposerDraft("chat-v3-draft:handoff"),
	);
	act(() =>
		connecting.result.current.onDraftChange(draft("typed while connecting")),
	);

	const connected = renderHook(() => useComposerDraft("chat-v3-draft:handoff"));
	connecting.unmount();

	expect(connected.result.current.storedDraft?.text).toBe(
		"typed while connecting",
	);
});

test("recovered text survives the composer's own save on unmount", () => {
	const recoveredFirst = renderHook(() =>
		useComposerDraft("chat-v3-draft:recover-a"),
	);
	act(() => recoveredFirst.result.current.onDraftChange(draft("newer draft")));
	prependToDraft("chat-v3-draft:recover-a", [draft("unsent message")]);
	recoveredFirst.unmount();
	expect(stored("chat-v3-draft:recover-a").text).toBe(
		"unsent message\n\nnewer draft",
	);

	const flushedFirst = renderHook(() =>
		useComposerDraft("chat-v3-draft:recover-b"),
	);
	act(() => flushedFirst.result.current.onDraftChange(draft("newer draft")));
	flushedFirst.unmount();
	prependToDraft("chat-v3-draft:recover-b", [draft("unsent message")]);
	expect(stored("chat-v3-draft:recover-b").text).toBe(
		"unsent message\n\nnewer draft",
	);
});

test("unsent prompts with pasted cards join a draft with its own card", () => {
	const hook = renderHook(() => useComposerDraft("chat-v3-draft:pastes"));
	act(() => hook.result.current.onDraftChange(draft("draft", ["draft log"])));
	hook.unmount();
	prependToDraft("chat-v3-draft:pastes", [
		draft("first", ["first log"]),
		draft("second", ["second log"]),
	]);

	expect(stored("chat-v3-draft:pastes")).toMatchObject({
		text: "first\n\nsecond\n\ndraft",
		pastedTexts: ["first log", "second log", "draft log"],
	});
});

test("chips keep their place and identity through a save and a merge", () => {
	const chip = { label: "Fix the mic", serialized: "@SUP-12", data: { id: 1 } };
	const hook = renderHook(() => useComposerDraft("chat-v3-draft:chips"));
	act(() =>
		hook.result.current.onDraftChange({
			...EMPTY_DRAFT,
			text: "see @SUP-12",
			chips: [{ start: 4, end: 11, chip }],
		}),
	);
	hook.unmount();
	prependToDraft("chat-v3-draft:chips", [draft("unsent")]);

	expect(stored("chat-v3-draft:chips")).toMatchObject({
		text: "unsent\n\nsee @SUP-12",
		chips: [{ start: 12, end: 19, chip }],
	});
});

test("a draft saved as plain text before chips were kept still opens", () => {
	window.localStorage.setItem(
		"chat-v3-draft:legacy",
		appendPastedText("old draft", ["old log"]),
	);
	const hook = renderHook(() => useComposerDraft("chat-v3-draft:legacy"));
	expect(hook.result.current.storedDraft).toEqual(
		draftFromText(appendPastedText("old draft", ["old log"])),
	);
	expect(hook.result.current.storedDraft).toMatchObject({
		text: "old draft",
		pastedTexts: ["old log"],
	});
});

test("attachments stay in memory and are never saved", () => {
	const file = new File(["x"], "shot.png", { type: "image/png" });
	const first = renderHook(() => useComposerDraft("chat-v3-draft:files"));
	act(() =>
		first.result.current.onDraftChange({
			...draft("look"),
			attachments: [{ id: "a1", file }],
		}),
	);
	first.unmount();

	expect(window.localStorage.getItem("chat-v3-draft:files")).not.toContain(
		"shot.png",
	);
	const next = renderHook(() => useComposerDraft("chat-v3-draft:files"));
	expect(next.result.current.storedDraft?.attachments).toEqual([
		{ id: "a1", file },
	]);
});

test("a draft that fails to save is still read from memory", () => {
	const setItem = spyOn(window.localStorage, "setItem").mockImplementation(
		() => {
			throw new Error("QuotaExceededError");
		},
	);
	const warn = spyOn(console, "warn").mockImplementation(() => {});
	try {
		const first = renderHook(() => useComposerDraft("chat-v3-draft:quota"));
		act(() => first.result.current.onDraftChange(draft("kept in memory")));
		first.unmount();

		const next = renderHook(() => useComposerDraft("chat-v3-draft:quota"));
		expect(next.result.current.storedDraft?.text).toBe("kept in memory");
	} finally {
		setItem.mockRestore();
		warn.mockRestore();
	}
});

test("text recovered after a composer read its draft is handed to it once", () => {
	renderHook(() => useComposerDraft("chat-v3-draft:late"));
	prependToDraft("chat-v3-draft:late", [draft("unsent message")]);
	expect(takeRecoveredDraft("chat-v3-draft:late")?.text).toBe("unsent message");
	expect(takeRecoveredDraft("chat-v3-draft:late")).toBeNull();

	prependToDraft("chat-v3-draft:early", [draft("unsent message")]);
	const reader = renderHook(() => useComposerDraft("chat-v3-draft:early"));
	expect(reader.result.current.storedDraft?.text).toBe("unsent message");
	expect(takeRecoveredDraft("chat-v3-draft:early")).toBeNull();
});

test("text recovered while another target is open shows once on return", () => {
	const hook = renderHook(
		({ draftKey, persisted }: { draftKey: string; persisted: boolean }) =>
			useComposerDraft(draftKey, persisted),
		{ initialProps: { draftKey: "chat-v3-draft:return", persisted: true } },
	);
	hook.rerender({
		draftKey: "chat-v3-draft:return:subagent:c1",
		persisted: false,
	});
	prependToDraft("chat-v3-draft:return", [draft("unsent message")]);

	hook.rerender({ draftKey: "chat-v3-draft:return", persisted: true });

	expect(hook.result.current.storedDraft?.text).toBe("unsent message");
	expect(takeRecoveredDraft("chat-v3-draft:return")).toBeNull();
});

test("text restored to a subagent's draft stays in memory and reaches its composer", () => {
	prependToDraft(
		"chat-v3-draft:t1:subagent:c1",
		[draft("for the subagent")],
		false,
	);
	expect(
		window.localStorage.getItem("chat-v3-draft:t1:subagent:c1"),
	).toBeNull();

	const reopened = renderHook(() =>
		useComposerDraft("chat-v3-draft:t1:subagent:c1", false),
	);
	expect(reopened.result.current.storedDraft?.text).toBe("for the subagent");
});
