import { useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { Spinner } from "@superset/ui/spinner";
import { cn } from "@superset/ui/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	DownloadIcon,
	XIcon,
} from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

interface ImagePreviewOverlayProps {
	/** Null while the bytes load; `fallback` or a spinner shows in its place. */
	src: string | null;
	filename: string;
	open: boolean;
	onClose: () => void;
	onDownload: () => Promise<void>;
	fallback?: ReactNode;
	onCopy?: (() => Promise<void>) | undefined;
	onPrevious?: (() => void) | undefined;
	onNext?: (() => void) | undefined;
	/** The image's place in a sequence; the step buttons and count show only with more than one. */
	position?: { index: number; total: number } | undefined;
	/** Takes focus when the overlay closes; otherwise the element focused when it opened. */
	focusOnClose?: (() => HTMLElement | null | undefined) | undefined;
}

const SCRIM_BUTTON_CLASS =
	"flex cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:bg-white/25 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white/10";
const CORNER_BUTTON_CLASS = cn(SCRIM_BUTTON_CLASS, "size-10");
const EDGE_BUTTON_CLASS = cn(
	SCRIM_BUTTON_CLASS,
	"-translate-y-1/2 absolute top-1/2 size-12",
);
const COPIED_MS = 1500;

function isCopyShortcut(event: KeyboardEvent): boolean {
	return (
		(event.metaKey || event.ctrlKey) &&
		!event.altKey &&
		!event.shiftKey &&
		event.key.toLowerCase() === "c"
	);
}

/**
 * Full-screen image preview: dark scrim, centered image, floating buttons in
 * the top-right corner. Escape or a scrim click closes; Left and Right step
 * through a sequence; ⌘C copies the image unless text is selected.
 */
export function ImagePreviewOverlay({
	src,
	filename,
	open,
	onClose,
	onDownload,
	fallback,
	onCopy,
	onPrevious,
	onNext,
	position,
	focusOnClose,
}: ImagePreviewOverlayProps) {
	const { t } = useLingui();
	const [isSaving, setIsSaving] = useState(false);
	const [copiedSrc, setCopiedSrc] = useState<string | null>(null);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const openerRef = useRef<HTMLElement | null>(null);
	const focusOnCloseRef = useRef(focusOnClose);
	focusOnCloseRef.current = focusOnClose;

	const inSequence = position !== undefined && position.total > 1;
	const hasPrevious = inSequence && position.index > 0;
	const hasNext = inSequence && position.index < position.total - 1;
	const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
	const shownSrc = src !== null && src !== brokenSrc ? src : null;
	const copied = shownSrc !== null && copiedSrc === shownSrc;

	const handleCopy = async () => {
		if (!onCopy) return;
		try {
			await onCopy();
			setCopiedSrc(src);
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
			copiedTimer.current = setTimeout(() => setCopiedSrc(null), COPIED_MS);
		} catch {
			toast.error(t({ message: "Couldn't copy the image" }));
		}
	};
	useEffect(
		() => () => {
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		},
		[],
	);

	const keysRef = useRef({ onClose, onPrevious, onNext, handleCopy });
	keysRef.current = { onClose, onPrevious, onNext, handleCopy };
	const stepsRef = useRef({ hasPrevious, hasNext, canCopy: Boolean(onCopy) });
	stepsRef.current = { hasPrevious, hasNext, canCopy: Boolean(onCopy) };
	useEffect(() => {
		if (!open) return;
		const handler = (event: KeyboardEvent) => {
			const keys = keysRef.current;
			const steps = stepsRef.current;
			if (event.key === "Escape") {
				event.stopPropagation();
				keys.onClose();
				return;
			}
			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				event.stopPropagation();
				event.preventDefault();
				if (event.key === "ArrowLeft" && steps.hasPrevious) keys.onPrevious?.();
				if (event.key === "ArrowRight" && steps.hasNext) keys.onNext?.();
				return;
			}
			if (
				isCopyShortcut(event) &&
				steps.canCopy &&
				!window.getSelection()?.toString()
			) {
				event.stopPropagation();
				event.preventDefault();
				void keys.handleCopy();
			}
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [open]);

	const wasOpen = useRef(false);
	useEffect(() => {
		if (open) {
			wasOpen.current = true;
			const active = document.activeElement;
			openerRef.current = active instanceof HTMLElement ? active : null;
			dialogRef.current?.focus();
			return;
		}
		if (!wasOpen.current) return;
		wasOpen.current = false;
		const target = focusOnCloseRef.current?.() ?? openerRef.current;
		if (target?.isConnected) target.focus();
	}, [open]);

	const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Tab" || !dialogRef.current) return;
		const focusable = [
			...dialogRef.current.querySelectorAll<HTMLElement>(
				"button:not([disabled])",
			),
		];
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) {
			event.preventDefault();
			return;
		}
		const active = document.activeElement;
		if (event.shiftKey && (active === first || active === dialogRef.current)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	};

	const handleDownload = async () => {
		setIsSaving(true);
		await onDownload();
		setIsSaving(false);
	};

	const current = position ? position.index + 1 : 0;
	const total = position?.total ?? 0;

	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div
					key="image-preview"
					aria-label={filename}
					aria-modal="true"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 outline-none"
					onClick={(e) => {
						if (e.target === e.currentTarget) onClose();
					}}
					onKeyDown={trapTab}
					ref={dialogRef}
					role="dialog"
					tabIndex={-1}
				>
					{shownSrc ? (
						<img
							src={shownSrc}
							alt={filename}
							className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
							onError={() => setBrokenSrc(shownSrc)}
						/>
					) : (
						<div className="flex items-center justify-center text-sm text-white/80">
							{src !== null
								? t({ message: `Couldn't load ${filename}` })
								: (fallback ?? <Spinner className="size-6 text-white" />)}
						</div>
					)}
					{inSequence && (
						<>
							<button
								type="button"
								aria-label={t({ message: "Previous image" })}
								className={cn(EDGE_BUTTON_CLASS, "left-4")}
								disabled={!hasPrevious}
								onClick={onPrevious}
							>
								<ChevronLeftIcon className="size-6" />
							</button>
							<button
								type="button"
								aria-label={t({ message: "Next image" })}
								className={cn(EDGE_BUTTON_CLASS, "right-4")}
								disabled={!hasNext}
								onClick={onNext}
							>
								<ChevronRightIcon className="size-6" />
							</button>
							<div className="-translate-x-1/2 absolute bottom-4 left-1/2 rounded-full bg-white/10 px-3 py-1 text-white/80 text-xs tabular-nums">
								{t({ message: `${current} of ${total}` })}
							</div>
						</>
					)}
					<div className="absolute top-4 right-4 flex items-center gap-2">
						{onCopy && (
							<button
								type="button"
								aria-label={
									copied
										? t({ message: "Copied" })
										: t({ message: "Copy image" })
								}
								disabled={shownSrc === null}
								onClick={() => void handleCopy()}
								className={CORNER_BUTTON_CLASS}
							>
								{copied ? (
									<CheckIcon className="size-4" />
								) : (
									<CopyIcon className="size-4" />
								)}
							</button>
						)}
						<button
							type="button"
							aria-label={t({
								message: "Download image",
							})}
							disabled={isSaving || shownSrc === null}
							onClick={() => void handleDownload()}
							className={CORNER_BUTTON_CLASS}
						>
							<DownloadIcon className="size-4" />
						</button>
						<button
							type="button"
							aria-label={t({
								message: "Close preview",
							})}
							onClick={onClose}
							className={CORNER_BUTTON_CLASS}
						>
							<XIcon className="size-4" />
						</button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
}
