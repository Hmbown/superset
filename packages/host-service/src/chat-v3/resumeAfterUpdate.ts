import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { userContentSchema } from "@superset/chat/protocol";
import type { ChatRuntime } from "@superset/chat-runtime";
import { z } from "zod";

export const RESUME_MARKER_MAX_AGE_MS = 30 * 60_000;

export const CONTINUE_AFTER_UPDATE_PROMPT =
	"Superset restarted to install an update, which stopped your work before it finished, including any commands running in the background. Continue where you left off.";

const markerSchema = z.object({
	requestedAt: z.number(),
	sessions: z
		.array(
			z.object({
				scopeId: z.string().min(1),
				harness: z.string().min(1),
				harnessSessionId: z.string().min(1),
				terminalId: z.string().min(1).optional(),
				modeId: z.string().optional(),
				modelId: z.string().optional(),
				interrupted: z.boolean(),
				prompts: z.array(z.array(userContentSchema).min(1)),
			}),
		)
		.optional(),
});

export function recordUnfinishedChats(
	runtime: ChatRuntime,
	markerPath: string,
): void {
	if (!existsSync(markerPath)) return;
	const marker = markerSchema.safeParse(readMarker(markerPath));
	writeFileSync(
		markerPath,
		JSON.stringify({
			requestedAt: marker.success ? marker.data.requestedAt : Date.now(),
			sessions: runtime.live.unfinished(),
		}),
	);
}

export function resumeUnfinishedChats(options: {
	markerPath: string;
	runtime: () => ChatRuntime;
	resolveCwd: (scopeId: string) => string;
	now?: number;
}): void {
	if (!existsSync(options.markerPath)) return;
	const marker = markerSchema.safeParse(readMarker(options.markerPath));
	rmSync(options.markerPath, { force: true });
	if (!marker.success || !marker.data.sessions?.length) return;
	const age = (options.now ?? Date.now()) - marker.data.requestedAt;
	if (age > RESUME_MARKER_MAX_AGE_MS) return;

	const runtime = options.runtime();
	for (const { interrupted, prompts, ...session } of marker.data.sessions) {
		if (!runtime.live.supports(session.harness)) continue;
		try {
			runtime.commands.resumeSession({
				...session,
				cwd: options.resolveCwd(session.scopeId),
				prompts: [
					...(interrupted
						? [[{ type: "text" as const, text: CONTINUE_AFTER_UPDATE_PROMPT }]]
						: []),
					...prompts,
				],
			});
		} catch (error) {
			console.warn("[chat-v3] could not resume a chat after the update", error);
		}
	}
}

function readMarker(markerPath: string): unknown {
	try {
		return JSON.parse(readFileSync(markerPath, "utf8"));
	} catch {
		return null;
	}
}
