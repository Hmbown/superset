export type CheckpointTarget = {
	cwd: string;
	sessionId: string;
	itemId: string;
};

export type RewindFilesResult = {
	files: "restored" | "missing" | "unsupported";
};

export type RewindSupport = {
	/** `native`: the agent cuts its own history. `text`: it is told the earlier conversation. */
	conversation: "native" | "text";
	files: boolean;
};

/** Snapshots of the working tree, taken just before each prompt reaches the agent. */
export type ChatCheckpoints = {
	capture(target: CheckpointTarget): Promise<void>;
	restore(target: CheckpointTarget): Promise<"restored" | "missing">;
	/** Whether this directory can be snapshotted at all. */
	available?(cwd: string): Promise<boolean>;
	/** Lets a session opened by a rewind restore the checkpoints of the one it came from. */
	fork?(input: {
		cwd: string;
		fromSessionId: string;
		toSessionId: string;
	}): Promise<void>;
};
