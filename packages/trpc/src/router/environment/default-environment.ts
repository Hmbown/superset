import { db } from "@superset/db/client";
import {
	environmentRepositories,
	environments,
	githubRepositories,
} from "@superset/db/schema";
import { SANDBOX_IMAGE_NAME } from "@superset/shared/constants";
import type { SandboxRegionId } from "@superset/shared/sandbox-regions";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { userError } from "../../trpc";

interface CarryingEnvironment {
	id: string;
	repositoryCount: number;
}

/**
 * Among the environments that check out a repository, oldest first: the first
 * that checks out only it, else the first of all. One that also carries other
 * repositories may open on one of those instead.
 */
export function pickDefaultEnvironment<T extends CarryingEnvironment>(
	carrying: readonly T[],
): T | undefined {
	return carrying.find((row) => row.repositoryCount === 1) ?? carrying[0];
}

/**
 * The environment a cloud workspace on one repository starts from when the
 * caller names none. An existing one the caller can use wins; otherwise a new
 * one named after the repository, shared with the organization, opening on
 * that repository, in `region`.
 */
export async function ensureDefaultEnvironment(args: {
	organizationId: string;
	repositoryId: string;
	userId: string;
	region: SandboxRegionId;
}): Promise<{ id: string; created: boolean }> {
	const carrying = await db
		.select({
			id: environments.id,
			repositoryCount: sql<number>`(
				select count(*)::int from ${environmentRepositories}
				where ${environmentRepositories.environmentId} = ${environments.id}
			)`,
		})
		.from(environments)
		.innerJoin(
			environmentRepositories,
			eq(environmentRepositories.environmentId, environments.id),
		)
		.where(
			and(
				eq(environments.organizationId, args.organizationId),
				isNull(environments.archivedAt),
				eq(environmentRepositories.repositoryId, args.repositoryId),
				or(
					eq(environments.scope, "organization"),
					eq(environments.createdByUserId, args.userId),
				),
			),
		)
		.orderBy(asc(environments.createdAt));
	const existing = pickDefaultEnvironment(carrying);
	if (existing) return { id: existing.id, created: false };

	const repository = await db.query.githubRepositories.findFirst({
		where: and(
			eq(githubRepositories.id, args.repositoryId),
			eq(githubRepositories.organizationId, args.organizationId),
		),
		columns: { id: true, name: true },
	});
	if (!repository) {
		throw userError({
			code: "NOT_FOUND",
			message: "The repository is not connected to this organization",
			i18nKey: "serverError.environment.repositoryNotConnected",
		});
	}
	const [row] = await db
		.insert(environments)
		.values({
			organizationId: args.organizationId,
			name: repository.name,
			provider: "vercel",
			sourceKind: "image",
			sourceRef: SANDBOX_IMAGE_NAME,
			region: args.region,
			scope: "organization",
			hooksRepositoryId: repository.id,
			createdByUserId: args.userId,
		})
		.returning({ id: environments.id });
	if (!row) {
		throw userError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Could not record environment",
			i18nKey: "serverError.environment.couldNotRecord",
		});
	}
	await db.insert(environmentRepositories).values({
		environmentId: row.id,
		repositoryId: repository.id,
	});
	return { id: row.id, created: true };
}
