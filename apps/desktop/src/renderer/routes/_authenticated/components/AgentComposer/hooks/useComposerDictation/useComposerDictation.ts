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
import { electronTrpc } from "renderer/lib/electron-trpc";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { useSettings } from "renderer/stores/settings";
import { encodeWav } from "./utils/encodeWav";

type TranscribeRequest = (input: {
	audio: string;
	mimeType: string;
}) => Promise<{ text: string }>;

export type DesktopTranscription = (
	| { ok: true; text: string }
	| { ok: false; error: string; message: string }
) & { engine?: "chatgpt" | "mac"; chatgptError?: string };

const BASE64_CHUNK = 0x8000;
const WAV_SAMPLE_RATE = 16_000;

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
		binary += String.fromCharCode(
			...bytes.subarray(index, index + BASE64_CHUNK),
		);
	}
	return btoa(binary);
}

/** Decodes the recorder's webm/opus into the WAV both desktop transcribers read. */
async function blobToWav(blob: Blob): Promise<Uint8Array> {
	const context = new OfflineAudioContext(1, 1, WAV_SAMPLE_RATE);
	const decoded = await context.decodeAudioData(await blob.arrayBuffer());
	const mono = new Float32Array(decoded.length);
	for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
		const data = decoded.getChannelData(channel);
		for (let index = 0; index < data.length; index += 1)
			mono[index] =
				(mono[index] ?? 0) + (data[index] ?? 0) / decoded.numberOfChannels;
	}
	return encodeWav(mono, WAV_SAMPLE_RATE);
}

async function requestDesktopTranscription(
	audio: Blob,
): Promise<DesktopTranscription> {
	const wav = await blobToWav(audio);
	return electronTrpcClient.dictation.transcribe.mutate({
		wav: bytesToBase64(wav),
	});
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
	transcribeOnDesktop,
}: {
	request: TranscribeRequest;
	notify: (message: string) => void;
	// ChatGPT via Codex, else the Mac, tried first; any failure falls back to the API.
	transcribeOnDesktop?: (audio: Blob) => Promise<DesktopTranscription>;
}): PromptInputDictation {
	return {
		maxSeconds: DICTATION_MAX_SECONDS,
		audioBitsPerSecond: DICTATION_AUDIO_BITS_PER_SECOND,
		async transcribe(audio) {
			if (transcribeOnDesktop) {
				const local = await transcribeOnDesktop(audio).catch(
					(error: unknown): DesktopTranscription => ({
						ok: false,
						error: "failed",
						message: error instanceof Error ? error.message : String(error),
					}),
				);
				if (local.chatgptError)
					console.warn("[dictation] ChatGPT was skipped", local.chatgptError);
				if (local.ok) return local.text;
				console.warn("[dictation] desktop transcription failed", local);
			}
			if (audio.size > DICTATION_MAX_AUDIO_BYTES)
				throw new DictationError(
					i18n._(msg({ message: "This recording is too long to transcribe" })),
					{ canRetry: false },
				);
			const encoded = bytesToBase64(new Uint8Array(await audio.arrayBuffer()));
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
	const { data: desktopAvailable } = electronTrpc.dictation.available.useQuery(
		undefined,
		{ staleTime: 5 * 60_000 },
	);
	const dictation = useMemo(
		() =>
			createComposerDictation({
				request: (input) => apiTrpcClient.voice.transcribe.mutate(input),
				notify: (message) => toast.error(message),
				transcribeOnDesktop: desktopAvailable
					? requestDesktopTranscription
					: undefined,
			}),
		[desktopAvailable],
	);
	return enabled ? dictation : undefined;
}
