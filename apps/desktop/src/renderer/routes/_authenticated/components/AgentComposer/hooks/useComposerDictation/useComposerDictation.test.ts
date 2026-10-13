import { describe, expect, test } from "bun:test";
import { DictationError } from "@superset/chat-ui/PromptInput";
import { DICTATION_MAX_AUDIO_BYTES } from "@superset/shared/voice";
import { TRPCClientError } from "@trpc/client";
import { createComposerDictation } from "./useComposerDictation";

function serverError(code: string) {
	return new TRPCClientError("server said no", {
		result: { error: { data: { code } } },
	} as never);
}

function setup(
	request: Parameters<typeof createComposerDictation>[0]["request"],
) {
	const notices: string[] = [];
	const dictation = createComposerDictation({
		request,
		notify: (message) => notices.push(message),
	});
	return { dictation, notices };
}

async function failure(promise: Promise<unknown> | unknown) {
	const error = await Promise.resolve(promise).catch((cause: unknown) => cause);
	expect(error).toBeInstanceOf(DictationError);
	return error as DictationError;
}

const clip = new Blob(["hi"], { type: "audio/webm;codecs=opus" });

describe("createComposerDictation", () => {
	test("sends the clip as base64 with its type and returns the text", async () => {
		const sent: { audio: string; mimeType: string }[] = [];
		const { dictation } = setup(async (input) => {
			sent.push(input);
			return { text: "ship it" };
		});
		expect(await dictation.transcribe(clip)).toBe("ship it");
		expect(sent).toEqual([
			{ audio: btoa("hi"), mimeType: "audio/webm;codecs=opus" },
		]);
	});

	test("marks a network failure retryable and leaves the toast to the composer row", async () => {
		const { dictation, notices } = setup(async () => {
			throw new TRPCClientError("Failed to fetch");
		});
		const error = await failure(dictation.transcribe(clip));
		expect(error.canRetry).toBe(true);
		dictation.onError?.(error);
		expect(notices).toEqual([]);
	});

	test("marks a rate limit retryable", async () => {
		const { dictation } = setup(async () => {
			throw serverError("TOO_MANY_REQUESTS");
		});
		expect((await failure(dictation.transcribe(clip))).canRetry).toBe(true);
	});

	test("toasts a failure that cannot be retried, e.g. an API without the procedure", async () => {
		const { dictation, notices } = setup(async () => {
			throw serverError("NOT_FOUND");
		});
		const error = await failure(dictation.transcribe(clip));
		expect(error.canRetry).toBe(false);
		dictation.onError?.(error);
		expect(notices).toEqual([error.message]);
	});

	test("does not retry a recording the server could not read", async () => {
		const { dictation } = setup(async () => {
			throw serverError("BAD_REQUEST");
		});
		expect((await failure(dictation.transcribe(clip))).canRetry).toBe(false);
	});

	test("refuses a clip over the size cap without calling the API", async () => {
		let called = false;
		const { dictation } = setup(async () => {
			called = true;
			return { text: "" };
		});
		const oversized = new Blob([new Uint8Array(DICTATION_MAX_AUDIO_BYTES + 1)]);
		expect((await failure(dictation.transcribe(oversized))).canRetry).toBe(
			false,
		);
		expect(called).toBe(false);
	});
});
