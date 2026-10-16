export type CheckpointTarget = {
	cwd: string;
	sessionId: string;
	itemId: string;
};

export type RewindFilesResult = {
	files: "restored" | "missing" | "unsupported";
};

/** Snapshots of the working tree, taken just before each prompt reaches the agent. */
export type ChatCheckpoints = {
	capture(target: CheckpointTarget): Promise<void>;
	restore(target: CheckpointTarget): Promise<"restored" | "missing">;
};
