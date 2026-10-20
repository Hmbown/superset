import { describe, expect, it } from "bun:test";
import type { SessionSnapshot, TurnGroup } from "@superset/chat/core";
import { buildChatRewindPrompt } from "@superset/shared/terminal-session-handoff";
import {
	editableMessageIds,
	rewindTranscript,
	timelineBefore,
} from "./messageEdit";

function userItem(id: string, text: string, startedAtMs: number) {
	return {
		kind: "item" as const,
		item: {
			id,
			kind: "user_message" as const,
			startedAtMs,
			content: [{ type: "text" as const, text }],
		},
	};
}

function agentItem(id: string) {
	return {
		kind: "item" as const,
		item: { id, kind: "agent_message" as const, startedAtMs: 0 },
	};
}

const groups = [
	{
		turnId: "t1",
		turn: null,
		entries: [userItem("u1", "first", 1), agentItem("a1")],
	},
	{
		turnId: "t2",
		turn: null,
		entries: [
			userItem("u2", "second", 2),
			agentItem("a2"),
			userItem("u3", "steer", 3),
		],
	},
] as unknown as TurnGroup[];

describe("messageEdit", () => {
	it("lets the user edit their own messages, not hidden ones", () => {
		const hidden = {
			turnId: "t3",
			turn: null,
			entries: [
				{
					...userItem("u4", "handoff", 4),
					item: { ...userItem("u4", "handoff", 4).item, hidden: true },
				},
			],
		} as unknown as TurnGroup;
		expect([...editableMessageIds([...groups, hidden], undefined)]).toEqual([
			"u1",
			"u2",
			"u3",
		]);
	});

	it("keeps only what came before the chosen message", () => {
		expect(timelineBefore(groups, "u1")).toEqual([]);
		expect(timelineBefore(groups, "u2")).toEqual([groups[0]] as TurnGroup[]);
		const beforeSteer = timelineBefore(groups, "u3");
		expect(beforeSteer).toHaveLength(2);
		expect(
			beforeSteer[1]?.entries.map(
				(entry) => entry.kind === "item" && entry.item.id,
			),
		).toEqual(["u2", "a2"]);
	});

	it("hands on an earlier rewind's conversation instead of nesting its prompt", () => {
		const earlier = "User: first\n\nClaude: done";
		const rewound = [
			{
				turnId: "t3",
				turn: null,
				entries: [
					userItem("h1", buildChatRewindPrompt({ transcript: earlier }), 4),
					agentItem("ack"),
					userItem("u4", "again", 5),
					agentItem("a4"),
					userItem("u5", "latest", 6),
				],
			},
		] as unknown as TurnGroup[];
		const snapshot = {
			items: new Map([
				[
					"ack",
					{
						item: {
							id: "ack",
							kind: "agent_message",
							startedAtMs: 0,
							text: "I have the context",
						},
					},
				],
				[
					"a4",
					{
						item: {
							id: "a4",
							kind: "agent_message",
							startedAtMs: 0,
							text: "did it",
						},
					},
				],
			]),
			liveStreams: new Map(),
			turns: new Map(),
			session: null,
		} as unknown as SessionSnapshot;

		expect(rewindTranscript(rewound, "u5", snapshot, "Claude")).toBe(
			`${earlier}\n\nUser: again\n\nClaude: did it`,
		);
	});
});
