import { describe, expect, it, test } from "bun:test";
import { userError } from "../../i18n-error";
import { classifyDispatchError, runSessionColumns } from "./run";

describe("classifyDispatchError", () => {
	test("maps both cloud billing refusals to cloud_usage_limit_reached", () => {
		for (const refusal of ["cloudNeedsPaidPlan", "usageLimitReached"]) {
			expect(
				classifyDispatchError(
					userError({
						code: "FORBIDDEN",
						message: refusal,
						i18nKey: `serverError.cloudWorkspace.${refusal}`,
					}),
				),
			).toBe("cloud_usage_limit_reached");
		}
	});
});

describe("runSessionColumns", () => {
	it("records a chat run as a chat, by the chat's terminal id", () => {
		expect(
			runSessionColumns({
				kind: "terminal",
				sessionId: "terminal-1",
				label: "Claude",
				chatSessionId: "chat-1",
			}),
		).toEqual({ sessionKind: "chat", terminalSessionId: "terminal-1" });
	});

	it("records a terminal run as a terminal", () => {
		expect(
			runSessionColumns({
				kind: "terminal",
				sessionId: "terminal-1",
				label: "Claude",
			}),
		).toEqual({ sessionKind: "terminal", terminalSessionId: "terminal-1" });
	});

	it("records no session for a run that started none", () => {
		expect(runSessionColumns(null)).toEqual({
			sessionKind: null,
			terminalSessionId: null,
		});
	});
});
