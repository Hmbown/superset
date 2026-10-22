export type SeatAction =
	| { kind: "none" }
	| { kind: "update"; quantity: number }
	| { kind: "schedule"; now: number; atRenewal: number | null };

/**
 * Added seats are billed now. Removed seats stay paid, with their cloud hours,
 * until renewal, when the count drops without a credit.
 */
export function licenseSeatAction({
	paid,
	members,
	decreasePending,
	periodEnd,
}: {
	paid: number;
	members: number;
	decreasePending: boolean;
	periodEnd: number | null;
}): SeatAction {
	if (members < paid) {
		return periodEnd
			? { kind: "schedule", now: paid, atRenewal: members }
			: { kind: "none" };
	}
	if (decreasePending) {
		return { kind: "schedule", now: members, atRenewal: null };
	}
	return members > paid
		? { kind: "update", quantity: members }
		: { kind: "none" };
}

export async function withRetry<T>(
	run: () => Promise<T>,
	{ attempts = 3, delayMs = 500 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await run();
		} catch (error) {
			if (attempt >= attempts) throw error;
			await new Promise((resolve) =>
				setTimeout(resolve, delayMs * 2 ** (attempt - 1)),
			);
		}
	}
}
