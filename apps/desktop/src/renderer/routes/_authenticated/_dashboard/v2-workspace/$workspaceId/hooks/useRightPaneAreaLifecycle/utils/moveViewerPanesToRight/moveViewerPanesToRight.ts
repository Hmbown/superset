import { transferPaneToNewTab, type WorkspaceStore } from "@superset/panes";
import type { StoreApi } from "zustand/vanilla";
import type { PaneViewerData } from "../../../../types";
import { CENTER_PANE_KINDS } from "../../constants";

type Store = StoreApi<WorkspaceStore<PaneViewerData>>;

export function moveViewerPanesToRight({
	center,
	right,
}: {
	center: Store;
	right: Store;
}): void {
	for (const tab of center.getState().tabs) {
		for (const pane of Object.values(tab.panes)) {
			if (CENTER_PANE_KINDS.has(pane.kind)) continue;
			if (pane.kind === "diff" && hasDiffPane(right)) {
				center
					.getState()
					.closePane({ tabId: tab.id, paneId: pane.id, intent: "remove" });
				continue;
			}
			transferPaneToNewTab({ source: center, target: right, paneId: pane.id });
		}
	}
}

function hasDiffPane(store: Store): boolean {
	return store
		.getState()
		.tabs.some((tab) =>
			Object.values(tab.panes).some((pane) => pane.kind === "diff"),
		);
}
