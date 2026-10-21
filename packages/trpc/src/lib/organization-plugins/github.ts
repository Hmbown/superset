import { installationOctokit } from "../sandbox/clone-token";

const BLOB_CONCURRENCY = 8;

export interface RepositorySnapshot {
	sha: string;
	paths: ReadonlySet<string>;
	read(path: string): Promise<Buffer>;
}

/** One commit of a repository, read through the organization's GitHub App installation. */
export async function repositorySnapshot(args: {
	installationId: string;
	repo: string;
	ref: string | null;
}): Promise<RepositorySnapshot> {
	const [owner, name] = args.repo.split("/");
	if (!owner || !name) throw new Error(`"${args.repo}" is not owner/name`);
	const octokit = await installationOctokit(args.installationId);

	const ref =
		args.ref ??
		(
			await octokit.request("GET /repos/{owner}/{repo}", {
				owner,
				repo: name,
			})
		).data.default_branch;
	const { sha } = (
		await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
			owner,
			repo: name,
			ref,
		})
	).data;
	const tree = (
		await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
			owner,
			repo: name,
			tree_sha: sha,
			recursive: "true",
		})
	).data;
	if (tree.truncated) {
		throw new Error(
			"the repository is too large for GitHub to list in one tree",
		);
	}

	const blobs = new Map<string, string>();
	for (const entry of tree.tree) {
		if (entry.type === "blob" && entry.path && entry.sha) {
			blobs.set(entry.path, entry.sha);
		}
	}

	return {
		sha,
		paths: new Set(blobs.keys()),
		async read(path) {
			const blob = blobs.get(path);
			if (!blob) throw new Error(`${path} is not in ${args.repo}@${sha}`);
			const { data } = await octokit.request(
				"GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
				{ owner, repo: name, file_sha: blob },
			);
			return Buffer.from(data.content, "base64");
		},
	};
}

export async function readAll(
	snapshot: RepositorySnapshot,
	paths: readonly string[],
): Promise<Map<string, Buffer>> {
	const out = new Map<string, Buffer>();
	for (let i = 0; i < paths.length; i += BLOB_CONCURRENCY) {
		const batch = paths.slice(i, i + BLOB_CONCURRENCY);
		const contents = await Promise.all(batch.map((p) => snapshot.read(p)));
		batch.forEach((path, index) => {
			out.set(path, contents[index] as Buffer);
		});
	}
	return out;
}
