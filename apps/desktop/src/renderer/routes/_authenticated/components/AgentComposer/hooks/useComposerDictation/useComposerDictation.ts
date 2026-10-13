import { msg } from "@lingui/core/macro";
import {
	DictationError,
	type PromptInputDictation,
} from "@superset/chat-ui/PromptInput";
import { i18n } from "@superset/i18n";
import {
	DICTATION_AUDIO_BITS_PER_SECOND,
	DICTATION_MAX_AUDIO_BYTES,
	DICTATION_MAX_SECONDS,
} from "@superset/shared/voice";
import { toast } from "@superset/ui/sonner";
import { TRPCClientError } from "@trpc/client";
import { useMemo } from "react";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { useSettings } from "renderer/stores/settings";

type TranscribeRequest = (input: {
	audio: string;
	mimeType: string;
}) => Promise<{ text: string }>;

const BASE64_CHUNK = 0x8000;

async function blobToBase64(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = "";
	for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
		binary += String.fromCharCode(
			...bytes.subarray(index, index + BASE64_CHUNK),
		);
	}
	return btoa(binary);
}

export function toDictationError(error: unknown): DictationError {
	const code = error instanceof TRPCClientError ? error.data?.code : undefined;
	// No tRPC envelope: the request never reached the API, or a proxy in
	// front of it answered.
	if (error instanceof TRPCClientError && error.data == null)
		return new DictationError(
			i18n._(msg({ message: "Check your connection and try again" })),
			{ canRetry: true },
		);
	switch (code) {
		// NOT_FOUND: an API deployed before voice.transcribe existed.
		case "NOT_FOUND":
		case "PRECONDITION_FAILED":
			return new DictationError(
				i18n._(msg({ message: "Dictation is not available right now" })),
				{ canRetry: false },
			);
		case "TOO_MANY_REQUESTS":
			return new DictationError(
				i18n._(msg({ message: "Too many dictations. Try again later." })),
				{ canRetry: true },
			);
		case "BAD_REQUEST":
			return new DictationError(
				i18n._(msg({ message: "Unable to transcribe this recording" })),
				{ canRetry: false },
			);
		case "UNAUTHORIZED":
			return new DictationError(
				i18n._(msg({ message: "Sign in again to use dictation" })),
				{ canRetry: false },
			);
		default:
			return new DictationError(
				i18n._(msg({ message: "Unable to transcribe audio" })),
				{ canRetry: true },
			);
	}
}

export function createComposerDictation({
	request,
	notify,
}: {
	request: TranscribeRequest;
	notify: (message: string) => void;
}): PromptInputDictation {
	return {
		maxSeconds: DICTATION_MAX_SECONDS,
		audioBitsPerSecond: DICTATION_AUDIO_BITS_PER_SECOND,
		async transcribe(audio) {
			if (audio.size > DICTATION_MAX_AUDIO_BYTES)
				throw new DictationError(
					i18n._(msg({ message: "This recording is too long to transcribe" })),
					{ canRetry: false },
				);
			const encoded = await blobToBase64(audio);
			try {
				const { text } = await request({
					audio: encoded,
					mimeType: audio.type || "audio/webm",
				});
				return text;
			} catch (error) {
				throw toDictationError(error);
			}
		},
		// A retryable failure already shows its message beside the retry
		// button in the composer.
		onError(error) {
			if (!error.canRetry) notify(error.message);
		},
	};
}

export function useComposerDictation(): PromptInputDictation | undefined {
	const enabled = useSettings((state) => state.dictationEnabled);
	const dictation = useMemo(
		() =>
			createComposerDictation({
				request: (input) => apiTrpcClient.voice.transcribe.mutate(input),
				notify: (message) => toast.error(message),
			}),
		[],
	);
	return enabled ? dictation : undefined;
}
