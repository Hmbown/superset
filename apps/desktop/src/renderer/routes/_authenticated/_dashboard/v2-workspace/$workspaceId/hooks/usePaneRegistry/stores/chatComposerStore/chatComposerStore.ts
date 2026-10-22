import { create } from "zustand";

export interface ChatComposerTarget {
	addFiles(files: File[]): void;
}

interface MountedComposer {
	workspaceId: string;
	target: ChatComposerTarget;
	lastActiveAt: number;
}

interface ChatComposerStore {
	composers: Record<string, MountedComposer>;
	register: (
		id: string,
		workspaceId: string,
		target: ChatComposerTarget,
	) => void;
	markActive: (id: string) => void;
	unregister: (id: string) => void;
}

export const useChatComposerStore = create<ChatComposerStore>()((set) => ({
	composers: {},
	register: (id, workspaceId, target) =>
		set((state) => ({
			composers: {
				...state.composers,
				[id]: { workspaceId, target, lastActiveAt: Date.now() },
			},
		})),
	markActive: (id) =>
		set((state) => {
			const composer = state.composers[id];
			if (!composer) return state;
			return {
				composers: {
					...state.composers,
					[id]: { ...composer, lastActiveAt: Date.now() },
				},
			};
		}),
	unregister: (id) =>
		set((state) => {
			const { [id]: _removed, ...rest } = state.composers;
			return { composers: rest };
		}),
}));

export function lastActiveChatComposer(
	composers: Record<string, MountedComposer>,
	workspaceId: string,
): ChatComposerTarget | null {
	let latest: MountedComposer | null = null;
	for (const composer of Object.values(composers)) {
		if (composer.workspaceId !== workspaceId) continue;
		if (!latest || composer.lastActiveAt >= latest.lastActiveAt) {
			latest = composer;
		}
	}
	return latest?.target ?? null;
}
