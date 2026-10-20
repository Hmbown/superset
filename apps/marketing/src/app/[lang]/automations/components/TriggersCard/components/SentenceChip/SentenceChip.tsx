export function SentenceChip({ children }: { children?: React.ReactNode }) {
	return (
		<span className="inline-flex h-6 items-center rounded-[6px] bg-foreground/[0.06] px-2 text-foreground">
			{children}
		</span>
	);
}
