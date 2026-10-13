import fs from "node:fs";
import path from "node:path";
import { boolean, CLIError, positional } from "@superset/cli-framework";
import { command } from "../../../../lib/command";

function readManifest(target: string): unknown {
	const resolved = path.resolve(target);
	const file =
		fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
			? path.join(resolved, "plugin.json")
			: resolved;
	if (!fs.existsSync(file)) {
		throw new CLIError(`No plugin.json at ${file}.`);
	}
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		throw new CLIError(
			`${file} is not valid JSON: ${(error as Error).message}`,
		);
	}
}

export default command({
	sandbox: false,
	description:
		"Upload a plugin to your organization. A new version replaces the current one for everyone who installed it",
	args: [
		positional("path")
			.required()
			.desc("A plugin directory, or its plugin.json"),
	],
	options: {
		publish: boolean().desc("Publish it to members in the same step"),
	},
	run: async ({ ctx, args, options }) => {
		const uploaded = await ctx.api.plugins.organization.upload.mutate({
			manifest: readManifest(args.path as string),
		});

		const published =
			options.publish && !uploaded.publishedAt
				? await ctx.api.plugins.organization.setPublished.mutate({
						name: uploaded.name,
						published: true,
					})
				: uploaded;

		const next = published.publishedAt
			? `Members install it with: superset plugins install ${uploaded.name}`
			: `It is a draft. Publish it: superset plugins organization publish ${uploaded.name}`;

		return {
			data: { ...uploaded, publishedAt: published.publishedAt },
			message: `${uploaded.replaced ? `Replaced ${uploaded.name}@${uploaded.replaced} with` : "Uploaded"} ${uploaded.name}@${uploaded.version}. ${next}`,
		};
	},
});
