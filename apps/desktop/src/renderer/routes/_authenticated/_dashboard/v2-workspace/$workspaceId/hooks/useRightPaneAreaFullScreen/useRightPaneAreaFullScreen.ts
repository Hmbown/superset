import { useCallback, useEffect, useRef, useState } from "react";

interface FullScreenState {
	workspaceId: string;
	closeOnExit: boolean;
}

export function useRightPaneAreaFullScreen({
	workspaceId,
	isOpen,
	setOpen,
}: {
	workspaceId: string;
	isOpen: boolean;
	setOpen: (open: boolean) => void;
}): { isFullScreen: boolean; toggle: () => void } {
	const [fullScreen, setFullScreen] = useState<FullScreenState | null>(null);
	const isFullScreen = fullScreen?.workspaceId === workspaceId;

	// Clear only when the pane goes from open to closed: entering from closed
	// sets the state before the open flag arrives, and must survive that gap.
	const wasOpenRef = useRef(isOpen);
	useEffect(() => {
		const wasOpen = wasOpenRef.current;
		wasOpenRef.current = isOpen;
		if (wasOpen && !isOpen) {
			setFullScreen((current) =>
				current?.workspaceId === workspaceId ? null : current,
			);
		}
	}, [isOpen, workspaceId]);

	const toggle = useCallback(() => {
		if (isFullScreen && isOpen) {
			if (fullScreen?.closeOnExit) setOpen(false);
			else setFullScreen(null);
			return;
		}
		setFullScreen({ workspaceId, closeOnExit: !isOpen });
		if (!isOpen) setOpen(true);
	}, [isFullScreen, isOpen, fullScreen, workspaceId, setOpen]);

	return { isFullScreen, toggle };
}
