import type {
	ComposerChip,
	ComposerChipMatch,
} from "@superset/chat-ui/PromptInput";
import type {
	LinkedIssue,
	LinkedPR,
} from "renderer/stores/new-workspace-draft";

export type LinkedContext =
	| { kind: "issue"; issue: LinkedIssue }
	| { kind: "pr"; pr: LinkedPR };

export function linkedIssueToken(issue: LinkedIssue): string {
	return issue.source === "github" && issue.number != null
		? `@#${issue.number}`
		: `@${issue.slug}`;
}

export function linkedPRToken(pr: LinkedPR): string {
	return `@PR#${pr.prNumber}`;
}

export function linkedIssueChip(issue: LinkedIssue): ComposerChip {
	return {
		label:
			issue.source === "github" && issue.number != null
				? `#${issue.number}`
				: issue.slug,
		description: issue.title,
		serialized: linkedIssueToken(issue),
		data: { linkedContext: { kind: "issue", issue } },
	};
}

export function linkedPRChip(pr: LinkedPR): ComposerChip {
	return {
		label: `PR #${pr.prNumber}`,
		description: pr.title,
		serialized: linkedPRToken(pr),
		data: { linkedContext: { kind: "pr", pr } },
	};
}

export function linkedContextOfChip(chip: ComposerChip): LinkedContext | null {
	const data = chip.data as { linkedContext?: LinkedContext } | undefined;
	return data?.linkedContext ?? null;
}

const TOKEN_TAIL = /[\p{L}\p{N}_-]/u;

function tokenIndex(text: string, token: string): number {
	let from = 0;
	for (;;) {
		const index = text.indexOf(token, from);
		if (index === -1) return -1;
		const next = text[index + token.length];
		if (next === undefined || !TOKEN_TAIL.test(next)) return index;
		from = index + 1;
	}
}

export function hasToken(text: string, token: string): boolean {
	return tokenIndex(text, token) !== -1;
}

export function findLinkedContextChips(
	text: string,
	issues: readonly LinkedIssue[],
	pr: LinkedPR | null,
): ComposerChipMatch[] {
	const chips = [
		...issues.map(linkedIssueChip),
		...(pr ? [linkedPRChip(pr)] : []),
	];
	return chips
		.map((chip) => ({ chip, start: tokenIndex(text, chip.serialized) }))
		.filter(({ start }) => start !== -1)
		.map(({ chip, start }) => ({
			chip,
			start,
			end: start + chip.serialized.length,
		}))
		.sort((a, b) => a.start - b.start);
}

export function linkedContextPrompt(
	issues: readonly LinkedIssue[],
	pr: LinkedPR | null = null,
): string {
	const tokens = [
		...(pr ? [linkedPRToken(pr)] : []),
		...issues.map(linkedIssueToken),
	];
	return tokens.length > 0 ? `${tokens.join(" ")} ` : "";
}

export function linkedContextChip(context: LinkedContext): ComposerChip {
	return context.kind === "pr"
		? linkedPRChip(context.pr)
		: linkedIssueChip(context.issue);
}
