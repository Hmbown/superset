import type { RendererContext } from "@superset/panes";
import { useCallback } from "react";
import { useV2UserPreferences } from "renderer/hooks/useV2UserPreferences";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import { useChangesTab } from "../../../../../../components/WorkspaceSidebar/hooks/useChangesTab";
import type { DiffPaneData, PaneViewerData } from "../../../../../../types";
import { useElementWidth } from "./hooks/useElementWidth";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const MIN_DIFF_WIDTH = 240;

interface DiffPaneFileListProps {
	context: RendererContext<PaneViewerData>;
	container: HTMLElement | null;
	workspaceId: string;
	onOpenFile: (path: string, openInNewTab?: boolean) => void;
}

export function DiffPaneFileList({
	context,
	container,
	workspaceId,
	onOpenFile,
}: DiffPaneFileListProps) {
	const { store, actions } = context;
	const data = context.pane.data as DiffPaneData;
	const { preferences, setChangesFileListWidth } = useV2UserPreferences();
	const width = preferences.changesFileListWidth ?? DEFAULT_WIDTH;
	const containerWidth = useElementWidth(container);
	const maxWidth =
		containerWidth === null
			? MAX_WIDTH
			: Math.min(MAX_WIDTH, containerWidth - MIN_DIFF_WIDTH);

	const handleSelectFile = useCallback(
		(path: string, openInNewTab?: boolean, changeKey?: string) => {
			if (openInNewTab) {
				store.getState().addTab({
					panes: [
						{
							kind: "diff",
							data: {
								path,
								changeKey,
								collapsedFiles: [],
								focusTick: Date.now(),
							} as DiffPaneData,
						},
					],
				});
				return;
			}
			actions.updateData({
				...data,
				path,
				changeKey,
				collapsedFiles: changeKey
					? (data.collapsedFiles ?? []).filter((key) => key !== changeKey)
					: (data.collapsedFiles ?? []),
				focusLine: undefined,
				focusSide: undefined,
				focusTick: Date.now(),
			} as DiffPaneData);
		},
		[store, actions, data],
	);

	const changesTab = useChangesTab({
		workspaceId,
		selectedDiffTarget: data.path
			? { path: data.path, changeKey: data.changeKey }
			: undefined,
		onSelectFile: handleSelectFile,
		onOpenFile,
	});

	if (containerWidth === null || maxWidth < MIN_WIDTH) return null;

	return (
		<ResizablePanel
			width={Math.min(width, maxWidth)}
			onWidthChange={setChangesFileListWidth}
			commitOnRelease
			minWidth={MIN_WIDTH}
			maxWidth={maxWidth}
			handleSide="right"
			onDoubleClickHandle={() => setChangesFileListWidth(DEFAULT_WIDTH)}
		>
			<div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
				{changesTab.content}
			</div>
		</ResizablePanel>
	);
}
