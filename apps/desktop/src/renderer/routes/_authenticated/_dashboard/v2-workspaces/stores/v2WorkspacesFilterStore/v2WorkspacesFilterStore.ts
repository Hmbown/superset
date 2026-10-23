import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEVICE_FILTER_THIS_DEVICE = "this-device";
export const DEVICE_FILTER_ALL_DEVICES = "all-devices";
/** Sentinel for project-less "session" workspaces in the project filter. */
export const PROJECT_FILTER_SESSIONS = "__sessions__";

export type V2WorkspacesDeviceFilter = string;
export type V2WorkspacesProjectFilter = string;

export type V2WorkspacesViewMode = "list" | "board";

interface V2WorkspacesFilterState {
	searchQuery: string;
	deviceFilter: V2WorkspacesDeviceFilter;
	/** Empty = all projects. May contain PROJECT_FILTER_SESSIONS. */
	projectFilters: string[];
	/** Creator user ids; empty = any creator. */
	creatorFilters: string[];
	/** Archived tombstones render in their own last sections (both views). */
	showArchived: boolean;
	viewMode: V2WorkspacesViewMode;
	setSearchQuery: (searchQuery: string) => void;
	setDeviceFilter: (deviceFilter: V2WorkspacesDeviceFilter) => void;
	setProjectFilters: (projectFilters: string[]) => void;
	setCreatorFilters: (creatorFilters: string[]) => void;
	setShowArchived: (showArchived: boolean) => void;
	setViewMode: (viewMode: V2WorkspacesViewMode) => void;
	/** Clears filters (incl. archived) — view mode persists. */
	reset: () => void;
}

export const useV2WorkspacesFilterStore = create<V2WorkspacesFilterState>()(
	persist(
		(set) => ({
			searchQuery: "",
			deviceFilter: DEVICE_FILTER_THIS_DEVICE,
			projectFilters: [],
			creatorFilters: [],
			showArchived: false,
			viewMode: "list",
			setSearchQuery: (searchQuery) => set({ searchQuery }),
			setDeviceFilter: (deviceFilter) => set({ deviceFilter }),
			setProjectFilters: (projectFilters) => set({ projectFilters }),
			setCreatorFilters: (creatorFilters) => set({ creatorFilters }),
			setShowArchived: (showArchived) => set({ showArchived }),
			setViewMode: (viewMode) => set({ viewMode }),
			reset: () =>
				set({
					searchQuery: "",
					deviceFilter: DEVICE_FILTER_THIS_DEVICE,
					projectFilters: [],
					creatorFilters: [],
					showArchived: false,
				}),
		}),
		{
			name: "v2-workspaces-view",
			// Fixed-size singleton: only the list/board choice survives reloads.
			// Filters and search stay per-visit (a `?view=` deep link still wins
			// — the page hydrates URL params over the rehydrated value on mount).
			partialize: (state) => ({ viewMode: state.viewMode }),
		},
	),
);
