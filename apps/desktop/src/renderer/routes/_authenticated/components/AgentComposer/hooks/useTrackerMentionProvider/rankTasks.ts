import Fuse from "fuse.js";

export type TaskCandidate = {
	id: string;
	slug: string;
	title: string;
	statusId: string | null;
	updatedAt: string | Date;
	branch: string | null;
};

const CLOSED_STATUS_TYPES = new Set(["completed", "canceled"]);

export function rankTasks(
	tasks: readonly TaskCandidate[],
	statusTypes: ReadonlyMap<string, string>,
	query: string,
	limit: number,
): TaskCandidate[] {
	const open = tasks.filter(
		(task) =>
			!task.statusId ||
			!CLOSED_STATUS_TYPES.has(statusTypes.get(task.statusId) ?? ""),
	);
	if (!query) {
		return [...open]
			.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			)
			.slice(0, limit);
	}
	return new Fuse(open, {
		keys: [
			{ name: "slug", weight: 3 },
			{ name: "title", weight: 2 },
		],
		threshold: 0.4,
		ignoreLocation: true,
	})
		.search(query, { limit })
		.map((result) => result.item);
}
