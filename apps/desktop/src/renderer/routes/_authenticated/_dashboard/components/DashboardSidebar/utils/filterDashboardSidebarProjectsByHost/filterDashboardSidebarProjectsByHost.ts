import type { SidebarProjectHostFilter } from "renderer/routes/_authenticated/providers/CollectionsProvider/dashboardSidebarLocal/schema";
import type {
	DashboardSidebarProject,
	DashboardSidebarProjectChild,
	DashboardSidebarWorkspace,
} from "../../types";

function keeps(
	workspace: DashboardSidebarWorkspace,
	filter: Exclude<SidebarProjectHostFilter, "all">,
): boolean {
	return (workspace.hostType === "cloud") === (filter === "cloud");
}

function sameItems<T>(next: T[], previous: T[]): boolean {
	return (
		next.length === previous.length &&
		next.every((item, index) => item === previous[index])
	);
}

function filterChildren(
	children: DashboardSidebarProjectChild[],
	filter: Exclude<SidebarProjectHostFilter, "all">,
): DashboardSidebarProjectChild[] {
	return children.flatMap((child): DashboardSidebarProjectChild[] => {
		if (child.type === "workspace") {
			return keeps(child.workspace, filter) ? [child] : [];
		}
		const workspaces = child.section.workspaces.filter((workspace) =>
			keeps(workspace, filter),
		);
		if (workspaces.length === 0) return [];
		if (sameItems(workspaces, child.section.workspaces)) return [child];
		return [{ type: "section", section: { ...child.section, workspaces } }];
	});
}

/**
 * Keeps only the rows that run where `filter` says: "local" is any device
 * (this one or a paired one), "cloud" is a sandbox. A project with nothing
 * left is dropped. Collapse state is untouched, and every project, folder
 * and row that survives whole is returned as the same object so the
 * sidebar's memoized rows don't re-render.
 */
export function filterDashboardSidebarProjectsByHost(
	projects: DashboardSidebarProject[],
	filter: SidebarProjectHostFilter,
): DashboardSidebarProject[] {
	if (filter === "all") return projects;

	return projects.flatMap((project): DashboardSidebarProject[] => {
		const children = filterChildren(project.children, filter);
		const cloudWorkspaces = (project.cloudWorkspaces ?? []).filter(
			(workspace) => keeps(workspace, filter),
		);
		if (children.length === 0 && cloudWorkspaces.length === 0) return [];
		if (
			sameItems(children, project.children) &&
			cloudWorkspaces.length === (project.cloudWorkspaces?.length ?? 0)
		) {
			return [project];
		}
		return [
			{
				...project,
				children,
				...(project.cloudWorkspaces ? { cloudWorkspaces } : {}),
			},
		];
	});
}
