import { app, net } from "electron";
import {
	createCodexTranscriber,
	readCodexChatGptToken,
} from "main/lib/codex-transcriber";
import {
	findTranscriberBinary,
	type NativeTranscription,
	transcribeNatively,
} from "main/lib/native-transcriber";
import { z } from "zod";
import { publicProcedure, router } from "..";
import { getProcessEnvWithShellPath } from "./workspaces/utils/shell-env";

export type DesktopTranscriptionResult = NativeTranscription & {
	engine?: "chatgpt" | "mac";
	// Why ChatGPT was not used when Codex is signed in to it.
	chatgptError?: string;
};

// Ten minutes of 16 kHz mono 16-bit WAV, base64-encoded, with headroom.
const MAX_WAV_BASE64_LENGTH = 32 * 1024 * 1024;

function transcriberBinary() {
	return findTranscriberBinary({
		isPackaged: app.isPackaged,
		resourcesPath: process.resourcesPath,
		appPath: app.getAppPath(),
	});
}

export const createDictationRouter = () => {
	const codex = createCodexTranscriber({
		// Chromium's stack keeps the cookies chatgpt.com's Cloudflare sets.
		fetchImpl: (url, init) => net.fetch(url, init),
		readToken: async (refresh) =>
			readCodexChatGptToken({
				env: await getProcessEnvWithShellPath(),
				refresh,
			}),
	});

	return router({
		available: publicProcedure.query(
			async () => transcriberBinary() !== null || (await codex.signedIn()),
		),

		// A ChatGPT sign-in in Codex first, then the Mac's own transcriber. A
		// failure here sends the renderer to the API.
		transcribe: publicProcedure
			.input(z.object({ wav: z.string().min(1).max(MAX_WAV_BASE64_LENGTH) }))
			.mutation(async ({ input }): Promise<DesktopTranscriptionResult> => {
				const wav = new Uint8Array(Buffer.from(input.wav, "base64"));
				const viaCodex = await codex.transcribe(wav);
				if (viaCodex?.ok) return { ...viaCodex, engine: "chatgpt" };
				const chatgptError =
					viaCodex && !viaCodex.ok ? viaCodex.message : undefined;
				if (chatgptError)
					console.warn(
						"[dictation] ChatGPT transcription failed",
						chatgptError,
					);
				const binary = transcriberBinary();
				if (!binary) {
					return {
						...(viaCodex ?? {
							ok: false,
							error: "unavailable",
							message: "No desktop transcriber is available",
						}),
						chatgptError,
					};
				}
				const viaMac = await transcribeNatively({ binary, wav });
				return { ...viaMac, engine: "mac", chatgptError };
			}),
	});
};
