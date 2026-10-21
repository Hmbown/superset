import { useCallback, useEffect, useRef } from "react";
import { trimmedSpacerHeight } from "./utils/trimmedSpacerHeight";

const SPACER_SELECTOR = "[data-message-scroller-spacer]";

// The scroller stops sizing its anchor spacer once the reader scrolls, which
// leaves empty space under a streaming reply. Keep only the part on screen.
export function useTrimAnchorSpacer(viewport: HTMLElement | null) {
	const readerScrolled = useRef(false);
	const trimRef = useRef<() => void>(() => {});

	useEffect(() => {
		const spacer = viewport?.querySelector<HTMLElement>(SPACER_SELECTOR);
		const content = spacer?.parentElement;
		if (!viewport || !spacer || !content) return;

		let scrollerHeight = spacer.style.height;
		const trim = () => {
			if (!readerScrolled.current || spacer.hidden) return;
			const height = trimmedSpacerHeight({
				clientHeight: viewport.clientHeight,
				scrollHeight: viewport.scrollHeight,
				scrollTop: viewport.scrollTop,
				spacerHeight: spacer.offsetHeight,
			});
			spacer.style.maxHeight = `${height}px`;
		};
		trimRef.current = trim;

		// A new height means the scroller anchored a message again.
		const styleObserver = new MutationObserver(() => {
			if (spacer.style.height === scrollerHeight) return;
			scrollerHeight = spacer.style.height;
			readerScrolled.current = false;
			spacer.style.maxHeight = "";
		});
		styleObserver.observe(spacer, {
			attributeFilter: ["style", "hidden"],
			attributes: true,
		});
		const resizeObserver = new ResizeObserver(trim);
		resizeObserver.observe(content);
		viewport.addEventListener("scroll", trim, { passive: true });
		return () => {
			trimRef.current = () => {};
			styleObserver.disconnect();
			resizeObserver.disconnect();
			viewport.removeEventListener("scroll", trim);
		};
	}, [viewport]);

	return useCallback(() => {
		readerScrolled.current = true;
		trimRef.current();
	}, []);
}
