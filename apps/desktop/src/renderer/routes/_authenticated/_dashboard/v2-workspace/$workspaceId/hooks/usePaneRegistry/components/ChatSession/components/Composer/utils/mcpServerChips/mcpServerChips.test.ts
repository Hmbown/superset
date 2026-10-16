import { describe, expect, it } from "bun:test";
import {
	findMcpServerTokens,
	mcpContextLine,
	mcpServerToken,
} from "./mcpServerChips";

describe("mcpServerToken", () => {
	it("adds the agent, then the scope, only when a listed server shares the name", () => {
		const user = { name: "docs", agent: "claude", scope: "user" } as const;
		const local = { name: "docs", agent: "claude", scope: "local" } as const;
		const codex = { name: "docs", agent: "codex", scope: "user" } as const;
		const solo = { name: "linear", agent: "claude", scope: "user" } as const;
		const servers = [user, local, codex, solo];

		expect(mcpServerToken(solo, servers)).toBe("@mcp/linear");
		expect(mcpServerToken(codex, servers)).toBe("@mcp/codex/docs");
		expect(mcpServerToken(local, servers)).toBe("@mcp/claude/local/docs");
	});
});

describe("findMcpServerTokens", () => {
	it("finds whole tokens and leaves trailing punctuation and lookalikes alone", () => {
		const text = "use @mcp/linear. and @mcp/codex/docs, not foo@mcp/x";
		expect(findMcpServerTokens(text)).toEqual([
			{ start: 4, end: 15, token: "@mcp/linear", name: "linear" },
			{ start: 21, end: 36, token: "@mcp/codex/docs", name: "docs" },
		]);
	});
});

describe("mcpContextLine", () => {
	it("names each server once and is absent without servers", () => {
		expect(mcpContextLine([])).toBeNull();
		expect(mcpContextLine(["linear", "linear", "docs"])).toBe(
			'MCP context: Use the configured MCP servers "linear", "docs" when relevant to this request.',
		);
	});
});
