import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useDashboardSidebarHoverActions } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarHoverProvider";
import { trackSafeTriangle } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/utils/safeTriangle";

interface UseDashboardSidebarChipHoverSuppressionResult {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onPointerEnter: () => void;
	onPointerLeave: (event: ReactPointerEvent) => void;
	/** For the card content: ends the safe-triangle hold once the pointer arrives. */
	onCardPointerEnter: () => void;
	toggleOpen: () => void;
}

/**
 * Controls a chip's hover card and keeps a ref-counted hold on the sidebar's
 * workspace hover card while the chip (or its card) is active. Holds still
 * owned on unmount are released automatically — a chip can disappear
 * mid-hover after a bulk close.
 *
 * `cardRef` is the card's content element. With it, leaving the chip on a
 * path aimed at the card keeps the card open across the gap (a safe
 * triangle); the card then closes on its own leave, or the moment the
 * pointer strays off that path.
 */
export function useDashboardSidebarChipHoverSuppression(
	cardRef?: RefObject<HTMLElement | null>,
): UseDashboardSidebarChipHoverSuppressionResult {
	const { beginHoverCardSuppression, endHoverCardSuppression } =
		useDashboardSidebarHoverActions();
	const holdsRef = useRef(0);
	const isOpenRef = useRef(false);
	const dismissedByClickRef = useRef(false);
	const stopTrackingRef = useRef<(() => void) | null>(null);
	const [isOpen, setIsOpen] = useState(false);

	const stopTracking = useCallback(() => {
		stopTrackingRef.current?.();
		stopTrackingRef.current = null;
	}, []);

	const hold = useCallback(() => {
		holdsRef.current += 1;
		beginHoverCardSuppression();
	}, [beginHoverCardSuppression]);

	const release = useCallback(() => {
		if (holdsRef.current === 0) return;
		holdsRef.current -= 1;
		endHoverCardSuppression();
	}, [endHoverCardSuppression]);

	const applyOpenChange = useCallback(
		(open: boolean) => {
			if (isOpenRef.current === open) return;
			isOpenRef.current = open;
			setIsOpen(open);
			if (open) {
				hold();
			} else {
				release();
			}
		},
		[hold, release],
	);

	const onOpenChange = useCallback(
		(open: boolean) => {
			// A pending hover-open timer can fire after the user clicks to close.
			// Keep the card dismissed until the pointer leaves or it is clicked again.
			if (open && dismissedByClickRef.current) return;
			// The pointer is crossing the gap toward the card: the tracker owns
			// the close until it arrives or strays.
			if (!open && stopTrackingRef.current) return;
			if (open) stopTracking();
			applyOpenChange(open);
		},
		[applyOpenChange, stopTracking],
	);

	const onPointerEnter = useCallback(() => {
		// Do not clear a click dismissal here. Removing the hover-card content can
		// produce another enter while the pointer is still over the trigger.
		stopTracking();
		hold();
	}, [hold, stopTracking]);

	const onPointerLeave = useCallback(
		(event: ReactPointerEvent) => {
			dismissedByClickRef.current = false;
			release();
			if (!isOpenRef.current || !cardRef?.current) return;
			stopTracking();
			stopTrackingRef.current = trackSafeTriangle({
				apex: { x: event.clientX, y: event.clientY },
				getCardElement: () => cardRef.current,
				onAbandon: () => {
					stopTracking();
					applyOpenChange(false);
				},
			});
		},
		[applyOpenChange, cardRef, release, stopTracking],
	);

	// The pointer made it: the card's own pointer-leave takes over.
	const onCardPointerEnter = useCallback(() => {
		stopTracking();
	}, [stopTracking]);

	const toggleOpen = useCallback(() => {
		const nextOpen = !isOpenRef.current;
		dismissedByClickRef.current = !nextOpen;
		onOpenChange(nextOpen);
	}, [onOpenChange]);

	useEffect(
		() => () => {
			stopTrackingRef.current?.();
			while (holdsRef.current > 0) {
				holdsRef.current -= 1;
				endHoverCardSuppression();
			}
		},
		[endHoverCardSuppression],
	);

	return {
		isOpen,
		onOpenChange,
		onPointerEnter,
		onPointerLeave,
		onCardPointerEnter,
		toggleOpen,
	};
}
