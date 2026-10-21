import { billingUsesAutumn } from "@superset/auth/autumn";
import { organizationBilling } from "@superset/auth/billing";
import type { db, dbWs } from "@superset/db/client";
import { environments } from "@superset/db/schema";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { userError } from "../../trpc";

type Transaction = Parameters<Parameters<typeof dbWs.transaction>[0]>[0];

export async function countActiveEnvironments(
	tx: typeof db | Transaction,
	organizationId: string,
): Promise<number> {
	const [row] = await tx
		.select({ used: count() })
		.from(environments)
		.where(
			and(
				eq(environments.organizationId, organizationId),
				isNull(environments.archivedAt),
			),
		);
	return row?.used ?? 0;
}

export async function assertEnvironmentCapacity(
	tx: Transaction,
	organizationId: string,
): Promise<void> {
	if (!billingUsesAutumn) return;
	const { environmentLimit } = await organizationBilling(organizationId);
	if (environmentLimit == null) return;
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtext(${`environments:${organizationId}`}))`,
	);
	if ((await countActiveEnvironments(tx, organizationId)) < environmentLimit) {
		return;
	}
	throw userError({
		code: "FORBIDDEN",
		message: `This organization has used all ${environmentLimit} of its environments. Archive one, or contact us to raise the limit`,
		i18nKey: "serverError.environment.limitReached",
		params: { limit: environmentLimit },
	});
}
