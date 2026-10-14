import { app } from "electron";
import {
	findTranscriberBinary,
	transcribeNatively,
} from "main/lib/native-transcriber";
import { z } from "zod";
import { publicProcedure, router } from "..";

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
	return router({
		nativeAvailable: publicProcedure.query(() => transcriberBinary() !== null),

		transcribe: publicProcedure
			.input(z.object({ wav: z.string().min(1).max(MAX_WAV_BASE64_LENGTH) }))
			.mutation(async ({ input }) => {
				const binary = transcriberBinary();
				if (!binary) {
					return {
						ok: false as const,
						error: "unavailable",
						message: "On-device dictation is not available",
					};
				}
				return transcribeNatively({
					binary,
					wav: new Uint8Array(Buffer.from(input.wav, "base64")),
				});
			}),
	});
};
