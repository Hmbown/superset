import { useLingui } from "@lingui/react/macro";
import { useLiveQuery } from "@tanstack/react-db";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolveProjectIconUrl } from "renderer/hooks/host-projects/resolveProjectIconUrl";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import { useKnownHosts } from "renderer/hooks/known-hosts/useKnownHosts";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { useCloudWorkspaces } from "renderer/hooks/useCloudWorkspaces";
import { useRelayUrl } from "renderer/hooks/useRelayUrl";
import { authClient } from "renderer/lib/auth-client";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import {
	type CloudPullRequestRef,
	useCloudPullRequests,
} from "renderer/routes/_authenticated/_dashboard/hooks/useCloudPullRequests";
import { useCloudWorkspaceRepositories } from "renderer/routes/_authenticated/_dashboard/hooks/useCloudWorkspaceRepositories";
import {
	EMPTY_CLOUD_SIDEBAR,
	useCloudSidebarStore,
} from "renderer/routes/_authenticated/_dashboard/stores/cloudSidebarStore";
import { isInCloudSidebar } from "renderer/routes/_authenticated/_dashboard/utils/buildCloudSidebar";
import { useDashboardSidebarState } from "renderer/routes/_authenticated/hooks/useDashboardSidebarState";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { getVisibleSidebarWorkspaces } from "renderer/routes/_authenticated/providers/CollectionsProvider/dashboardSidebarLocal";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import {
	deriveTagFolders,
	useTagFolderContext,
} from "renderer/routes/_authenticated/utils/workspaceTagFolders";
import { useWorkspaceTransactionsStore } from "renderer/stores/workspace-creates";
import type {
	DashboardSidebarHiddenProject,
	DashboardSidebarPinnedWorkspace,
	DashboardSidebarProject,
	DashboardSidebarWorkspace,
} from "../../types";
import { buildCloudSidebarWorkspaces } from "./buildCloudSidebarWorkspaces";
import {
	buildDashboardSidebarPinnedWorkspaces,
	buildDashboardSidebarProjects,
	buildDashboardSidebarSessions,
	partitionSidebarWorkspacesByPinned,
} from "./buildDashboardSidebarProjects";
import {
	derivePullRequestQueryTargets,
	getDashboardSidebarPullRequestQueryKey,
	type PullRequestQueryTarget,
} from "./derivePullRequestQueryTargets";
import { pickGithubStatus } from "./pickGithubStatus";
import { createPullRequestRefreshGate } from "./pullRequestRefreshCooldown";

// Module-level so remounting the sidebar doesn't reset the cool-down.
const pullRequestRefreshGate = createPullRequestRefreshGate();

type SidebarPullRequest = DashboardSidebarWorkspace["pullRequest"];
type PullRequestWorkspaceRow = {
	workspaceId: string;
	pullRequest: SidebarPullRequest;
};

function haveSameProjects(
	left: DashboardSidebarProject[],
	right: DashboardSidebarProject[],
): boolean {
	return (
		left.length === right.length &&
		left.every((project, index) => project === right[index])
	);
}

function getPullRequestRowsFingerprint(
	rows: PullRequestWorkspaceRow[],
): string {
	return JSON.stringify(
		rows
			.map((row) => [row.workspaceId, row.pullRequest] as const)
			.sort(([leftWorkspaceId], [rightWorkspaceId]) =>
				leftWorkspaceId.localeCompare(rightWorkspaceId),
			),
	);
}

function getDashboardSidebarProjectFingerprint(
	project: DashboardSidebarProject,
): string {
	return JSON.stringify(project);
}

function useStablePullRequestsByWorkspaceId(
	rows: PullRequestWorkspaceRow[] | undefined,
): Map<string, SidebarPullRequest> {
	const previousRef = useRef<{
		fingerprint: string;
		map: Map<string, SidebarPullRequest>;
	} | null>(null);

	return useMemo(() => {
		const nextRows = rows ?? [];
		const fingerprint = getPullRequestRowsFingerprint(nextRows);
		const previous = previousRef.current;
		if (previous?.fingerprint === fingerprint) {
			return previous.map;
		}

		const map = new Map(
			nextRows.map((workspace) => [
				workspace.workspaceId,
				workspace.pullRequest,
			]),
		);
		previousRef.current = { fingerprint, map };
		return map;
	}, [rows]);
}

/**
 * Returns the previous reference while the JSON serialization is unchanged.
 * Same purpose as the fingerprinted hooks below: the sidebar builders produce
 * fresh arrays every run, and downstream memoization needs stable identities.
 */
function useJsonStable<Value>(value: Value): Value {
	const previousRef = useRef<{ fingerprint: string; value: Value } | null>(
		null,
	);
	return useMemo(() => {
		const fingerprint = JSON.stringify(value);
		const previous = previousRef.current;
		if (previous?.fingerprint === fingerprint) {
			return previous.value;
		}
		previousRef.current = { fingerprint, value };
		return value;
	}, [value]);
}

function useStableDashboardSidebarProjects(
	projects: DashboardSidebarProject[],
): DashboardSidebarProject[] {
	const previousRef = useRef<{
		projects: DashboardSidebarProject[];
		byId: Map<
			string,
			{ fingerprint: string; project: DashboardSidebarProject }
		>;
	} | null>(null);

	return useMemo(() => {
		const previous = previousRef.current;
		const nextById = new Map<
			string,
			{ fingerprint: string; project: DashboardSidebarProject }
		>();
		const nextProjects = projects.map((project) => {
			const fingerprint = getDashboardSidebarProjectFingerprint(project);
			const previousProject = previous?.byId.get(project.id);
			const stableProject =
				previousProject?.fingerprint === fingerprint
					? previousProject.project
					: project;

			nextById.set(project.id, { fingerprint, project: stableProject });
			return stableProject;
		});

		if (previous && haveSameProjects(previous.projects, nextProjects)) {
			previousRef.current = { projects: previous.projects, byId: nextById };
			return previous.projects;
		}

		previousRef.current = { projects: nextProjects, byId: nextById };
		return nextProjects;
	}, [projects]);
}

interface UseDashboardSidebarDataOptions {
	/**
	 * File cloud workspaces under their repo's project instead of leaving
	 * them to the Cloud section.
	 */
	inlineCloudWorkspaces?: boolean;
}

export function useDashboardSidebarData({
	inlineCloudWorkspaces = false,
}: UseDashboardSidebarDataOptions = {}) {
	const { t } = useLingui();
	const collections = useCollections();
	const { machineId, activeHostUrl } = useLocalHostService();
	const relayUrl = useRelayUrl();
	const { ensureProjectInSidebar, toggleProjectCollapsed } =
		useDashboardSidebarState();
	const queryClient = useQueryClient();
	const workspaceTransactionsById = useWorkspaceTransactionsStore(
		(state) => state.byWorkspaceId,
	);

	const { hosts, organizationId: knownHostsOrgId } = useKnownHosts();
	const hostsByMachineId = useMemo(
		() => new Map(hosts.map((host) => [host.machineId, host])),
		[hosts],
	);

	// Placement (order/collapse) is local; project identity comes from the
	// host fan-out (useHostProjects) — projects are fully local, so the
	// sidebar joins the two in JS on the project id.
	const { data: sidebarProjectRows = [], isReady: sidebarProjectRowsReady } =
		useLiveQuery(
			(q) =>
				q
					.from({ sidebarProjects: collections.v2SidebarProjects })
					.select(({ sidebarProjects }) => ({
						projectId: sidebarProjects.projectId,
						isCollapsed: sidebarProjects.isCollapsed,
						isHidden: sidebarProjects.isHidden,
						tabOrder: sidebarProjects.tabOrder,
					})),
			[collections],
		);
	// Sorted in JS, not via the query's orderBy: the incremental orderBy
	// does not reliably re-sort on row inserts/renumbers (a newly added
	// project stayed appended at the bottom until reload), and tabOrders
	// can collide (bulk ensure paths mint duplicates) so ties need a
	// stable secondary key. Workspaces/sections don't need this — the
	// project-tree builder re-sorts them by tabOrder itself.
	const orderedSidebarProjectRows = useMemo(
		() =>
			[...sidebarProjectRows].sort(
				(left, right) =>
					left.tabOrder - right.tabOrder ||
					left.projectId.localeCompare(right.projectId),
			),
		[sidebarProjectRows],
	);

	const { projects: hostProjects } = useHostProjects();

	const hostProjectsByKey = useMemo(
		() => new Map(hostProjects.map((project) => [project.projectKey, project])),
		[hostProjects],
	);
	const sidebarProjects = useMemo(
		() =>
			orderedSidebarProjectRows.flatMap((row) => {
				// A hidden project keeps its placement rows but renders nowhere;
				// it comes back through the "hidden projects" restore list.
				if (row.isHidden) return [];
				const project = hostProjectsByKey.get(row.projectId);
				// No host serves it: stale placement row (deleted project) — drop
				// it, same as the old inner join did.
				if (!project) return [];
				return [
					{
						id: project.projectKey,
						name: project.name,
						githubOwner: project.repoOwner,
						githubRepoName: project.repoName,
						iconUrl: resolveProjectIconUrl(project),
						color: project.color,
						createdAt: new Date(project.createdAt),
						updatedAt: new Date(project.updatedAt),
						isCollapsed: row.isCollapsed,
					},
				];
			}),
		[orderedSidebarProjectRows, hostProjectsByKey],
	);
	const hiddenProjects = useMemo<DashboardSidebarHiddenProject[]>(
		() =>
			orderedSidebarProjectRows.flatMap((row) => {
				if (!row.isHidden) return [];
				const project = hostProjectsByKey.get(row.projectId);
				if (!project) return [];
				return [
					{
						id: project.projectKey,
						name: project.name,
						iconUrl: resolveProjectIconUrl(project),
						color: project.color,
					},
				];
			}),
		[orderedSidebarProjectRows, hostProjectsByKey],
	);

	const { data: storedSidebarSections = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarSections: collections.v2SidebarSections })
				// Same tie-breaking rationale as the projects query above.
				.orderBy(({ sidebarSections }) => sidebarSections.tabOrder, "asc")
				.orderBy(({ sidebarSections }) => sidebarSections.sectionId, "asc")
				.select(({ sidebarSections }) => ({
					sectionId: sidebarSections.sectionId,
					projectId: sidebarSections.projectId,
					name: sidebarSections.name,
					createdAt: sidebarSections.createdAt,
					isCollapsed: sidebarSections.isCollapsed,
					tabOrder: sidebarSections.tabOrder,
					color: sidebarSections.color,
					tag: sidebarSections.tag,
				})),
		[collections],
	);

	const { workspaces: allHostWorkspaces, cache: hostWorkspacesCache } =
		useHostWorkspaces();
	// A cloud workspace's rows come from the cloud list, never from its
	// sandbox's host rows, whatever placement their local-state row carries.
	const hostWorkspaces = useMemo(
		() =>
			allHostWorkspaces.filter(
				(workspace) => !hostWorkspacesCache.isSandboxHost(workspace.hostId),
			),
		[allHostWorkspaces, hostWorkspacesCache],
	);
	const hostWorkspacesById = useMemo(
		() => new Map(hostWorkspaces.map((workspace) => [workspace.id, workspace])),
		[hostWorkspaces],
	);

	// The section lane the builder consumes is the deriveTagFolders union:
	// stored presentation rows PLUS folders that exist only because some
	// workspace carries the tag. A folder must exist because a workspace
	// carries the tag, not because a local row does.
	const tagFolderContext = useTagFolderContext();
	const sidebarSections = useMemo(
		() =>
			deriveTagFolders(
				storedSidebarSections,
				hostWorkspaces,
				tagFolderContext,
			).map((section) => ({
				id: section.sectionId,
				projectId: section.projectId,
				name: section.name,
				createdAt: section.createdAt,
				isCollapsed: section.isCollapsed,
				tabOrder: section.tabOrder,
				color: section.color,
				tag: section.tag,
			})),
		[hostWorkspaces, storedSidebarSections, tagFolderContext],
	);

	const { data: sidebarLocalStateRows = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarWorkspaces: collections.v2WorkspaceLocalState })
				// Same tie-breaking rationale as the projects query above.
				.orderBy(
					({ sidebarWorkspaces }) => sidebarWorkspaces.sidebarState.tabOrder,
					"asc",
				)
				.orderBy(
					({ sidebarWorkspaces }) => sidebarWorkspaces.workspaceId,
					"asc",
				)
				.select(({ sidebarWorkspaces }) => ({
					workspaceId: sidebarWorkspaces.workspaceId,
					projectId: sidebarWorkspaces.sidebarState.projectId,
					tabOrder: sidebarWorkspaces.sidebarState.tabOrder,
					sectionId: sidebarWorkspaces.sidebarState.sectionId,
					isHidden: sidebarWorkspaces.sidebarState.isHidden,
					pinnedAt: sidebarWorkspaces.sidebarState.pinnedAt,
				})),
		[collections],
	);
	const rawSidebarWorkspaces = useMemo(
		() =>
			sidebarLocalStateRows.flatMap((localState) => {
				const workspace = hostWorkspacesById.get(localState.workspaceId);
				if (!workspace) return [];
				return [
					{
						id: workspace.id,
						projectId: localState.projectId,
						hostId: workspace.hostId,
						type: workspace.type,
						name: workspace.name,
						branch: workspace.branch,
						taskId: workspace.taskId,
						createdAt: workspace.createdAt,
						updatedAt: workspace.updatedAt,
						lastActivityAt: workspace.lastActivityAt,
						tabOrder: localState.tabOrder,
						sectionId: localState.sectionId,
						tags: workspace.tags,
						isHidden: localState.isHidden,
						pinnedAt: localState.pinnedAt,
					},
				];
			}),
		[hostWorkspacesById, sidebarLocalStateRows],
	);
	const rawSidebarWorkspacesWithHostStatus = useMemo(
		() =>
			rawSidebarWorkspaces.map((workspace) => ({
				...workspace,
				hostIsOnline: hostsByMachineId.get(workspace.hostId)?.isOnline ?? false,
				pendingTransaction: workspaceTransactionsById[workspace.id] ?? null,
			})),
		[hostsByMachineId, rawSidebarWorkspaces, workspaceTransactionsById],
	);

	const sidebarWorkspaces = useMemo(
		() => getVisibleSidebarWorkspaces(rawSidebarWorkspacesWithHostStatus),
		[rawSidebarWorkspacesWithHostStatus],
	);

	// Placement is the only way into the sidebar: local and worktree rows
	// alike appear because a local-state row says so (the reconciler in
	// usePlaceWorktreesInSidebar writes one for anything created outside
	// this renderer), never because of the row's type.
	const visibleSidebarWorkspaces = sidebarWorkspaces;

	// From the placement rows, not the host-joined list: a hidden project
	// whose host is offline has no host metadata yet still has cached
	// workspace rows that must not poll.
	const hiddenProjectIds = useMemo(
		() =>
			new Set(
				orderedSidebarProjectRows
					.filter((row) => row.isHidden)
					.map((row) => row.projectId),
			),
		[orderedSidebarProjectRows],
	);
	const pullRequestQueryTargets = useMemo<PullRequestQueryTarget[]>(
		() =>
			derivePullRequestQueryTargets({
				activeHostUrl,
				hosts,
				machineId,
				relayUrl,
				// Sessions (null projectId) have no remote and never carry PRs.
				// A hidden project renders nothing, so its workspaces stop
				// polling too.
				workspaces: visibleSidebarWorkspaces.filter(
					(workspace) =>
						workspace.projectId !== null &&
						!hiddenProjectIds.has(workspace.projectId),
				),
				fallbackOrganizationId: knownHostsOrgId,
			}),
		[
			activeHostUrl,
			hiddenProjectIds,
			hosts,
			knownHostsOrgId,
			machineId,
			relayUrl,
			visibleSidebarWorkspaces,
		],
	);

	const pullRequestQueries = useQueries({
		queries: pullRequestQueryTargets.map((target) => ({
			queryKey: getDashboardSidebarPullRequestQueryKey(target),
			refetchInterval: 10_000,
			// Unreachable host: keep the query mounted so cached chips stay
			// rendered through the outage; fetches resume when the URL returns.
			enabled: target.hostUrl !== null,
			queryFn: async () => {
				if (!target.hostUrl) return { workspaces: [], github: null };
				const client = getHostServiceClientByUrl(target.hostUrl);
				return client.pullRequests.getByWorkspaces.query({
					workspaceIds: target.workspaceIds,
				});
			},
		})),
	});

	const pullRequestRows = useMemo<PullRequestWorkspaceRow[]>(() => {
		const rows: PullRequestWorkspaceRow[] = [];
		for (const query of pullRequestQueries) {
			const data = query.data;
			if (!data) continue;
			for (const row of data.workspaces) {
				rows.push({
					workspaceId: row.workspaceId,
					pullRequest: row.pullRequest,
				});
			}
		}
		return rows;
	}, [pullRequestQueries]);

	// One notice for the whole sidebar: the hold is per host credential, not
	// per workspace, and the local machine's is the one the user can fix.
	const githubStatus = useMemo(
		() =>
			pickGithubStatus(
				pullRequestQueries.map((query, index) => ({
					machineId: pullRequestQueryTargets[index]?.machineId ?? "",
					status: query.data?.github,
				})),
				machineId,
			),
		[machineId, pullRequestQueries, pullRequestQueryTargets],
	);

	const refreshWorkspacePullRequest = useCallback(
		async (workspaceId: string) => {
			const workspace = visibleSidebarWorkspaces.find(
				(candidate) => candidate.id === workspaceId,
			);
			if (!workspace) return;
			const target = pullRequestQueryTargets.find(
				(candidate) => candidate.machineId === workspace.hostId,
			);
			if (!target?.hostUrl) return;
			if (!pullRequestRefreshGate.shouldRefresh(workspaceId, Date.now())) {
				return;
			}

			const client = getHostServiceClientByUrl(target.hostUrl);
			await client.pullRequests.refreshByWorkspaces.mutate({
				workspaceIds: [workspaceId],
			});
			await queryClient.invalidateQueries({
				queryKey: getDashboardSidebarPullRequestQueryKey(target),
			});
		},
		[pullRequestQueryTargets, queryClient, visibleSidebarWorkspaces],
	);

	const pullRequestsByWorkspaceId =
		useStablePullRequestsByWorkspaceId(pullRequestRows);

	// Pinned rows render only in the top-level Pinned section, so they are
	// partitioned out before the per-project tree is built. PR polling targets
	// derive from the pre-partition list above, so pinned rows keep PR status.
	const { pinned: pinnedRows, unpinned: unpinnedRows } = useMemo(
		() => partitionSidebarWorkspacesByPinned(visibleSidebarWorkspaces),
		[visibleSidebarWorkspaces],
	);

	// Unpinned sessions render in the top-level Sessions section; pinned
	// sessions stay in Pinned like any other row.
	const { sessionRows, projectRows } = useMemo(() => {
		const sessions: typeof unpinnedRows = [];
		const projectScoped: typeof unpinnedRows = [];
		for (const row of unpinnedRows) {
			(row.projectId === null ? sessions : projectScoped).push(row);
		}
		return { sessionRows: sessions, projectRows: projectScoped };
	}, [unpinnedRows]);

	const computedGroups = useMemo<DashboardSidebarProject[]>(
		() =>
			buildDashboardSidebarProjects({
				sidebarProjects,
				sidebarSections,
				visibleSidebarWorkspaces: projectRows,
				machineId,
				pullRequestsByWorkspaceId,
			}),
		[
			machineId,
			pullRequestsByWorkspaceId,
			sidebarProjects,
			sidebarSections,
			projectRows,
		],
	);
	const organizationId = useActiveOrganizationId();
	const { data: session } = authClient.useSession();
	const userId = session?.user?.id ?? null;
	const { workspaces: cloudRows, isFresh: isCloudListFresh } =
		useCloudWorkspaces();
	const cloudSidebarEntries = useCloudSidebarStore((state) =>
		organizationId
			? (state.byOrganization[organizationId] ?? EMPTY_CLOUD_SIDEBAR).entries
			: EMPTY_CLOUD_SIDEBAR.entries,
	);
	const pruneCloudSidebarEntries = useCloudSidebarStore(
		(state) => state.pruneEntries,
	);
	useEffect(() => {
		if (
			!inlineCloudWorkspaces ||
			!organizationId ||
			!cloudRows ||
			!isCloudListFresh
		) {
			return;
		}
		pruneCloudSidebarEntries(
			organizationId,
			new Set(cloudRows.map((row) => row.id)),
		);
	}, [
		inlineCloudWorkspaces,
		organizationId,
		cloudRows,
		isCloudListFresh,
		pruneCloudSidebarEntries,
	]);
	const shownCloudRows = useMemo(
		() =>
			inlineCloudWorkspaces
				? (cloudRows ?? []).filter((row) =>
						isInCloudSidebar(row, cloudSidebarEntries[row.id], userId),
					)
				: [],
		[inlineCloudWorkspaces, cloudRows, cloudSidebarEntries, userId],
	);
	const { primaryRepositoryById: cloudRepoFullNameById } =
		useCloudWorkspaceRepositories({
			organizationId,
			enabled: shownCloudRows.length > 0,
		});
	// Only the open workspace's sandbox is a host, and it alone knows the
	// branch the agent has moved to; every other row shows its created branch.
	const cloudBranchById = useMemo(
		() =>
			new Map(
				allHostWorkspaces.map((workspace) => [workspace.id, workspace.branch]),
			),
		[allHostWorkspaces],
	);
	const cloudPullRequestRefs = useMemo<CloudPullRequestRef[]>(
		() =>
			shownCloudRows.flatMap((row) => {
				const repoFullName = cloudRepoFullNameById.get(row.id);
				return repoFullName
					? [
							{
								repoFullName,
								headBranch: cloudBranchById.get(row.id) ?? row.branch,
							},
						]
					: [];
			}),
		[shownCloudRows, cloudRepoFullNameById, cloudBranchById],
	);
	const { byRef: cloudPullRequestsByRef } =
		useCloudPullRequests(cloudPullRequestRefs);
	const cloudLayout = useMemo(
		() =>
			inlineCloudWorkspaces
				? buildCloudSidebarWorkspaces({
						cloudWorkspaces: shownCloudRows,
						entries: cloudSidebarEntries,
						userId,
						projects: sidebarProjects,
						repoFullNameById: cloudRepoFullNameById,
						branchById: cloudBranchById,
						pullRequestsByRef: cloudPullRequestsByRef,
						unknownRepoProjectName: t({ message: "Cloud" }),
					})
				: null,
		[
			inlineCloudWorkspaces,
			shownCloudRows,
			cloudSidebarEntries,
			userId,
			sidebarProjects,
			cloudRepoFullNameById,
			cloudBranchById,
			cloudPullRequestsByRef,
			t,
		],
	);

	// A stand-in repo project keeps its collapse, order and hidden state in
	// the same placement rows as a real project; the row is written on first
	// sight so the chevron works from the start.
	const sidebarProjectRowsById = useMemo(
		() => new Map(orderedSidebarProjectRows.map((row) => [row.projectId, row])),
		[orderedSidebarProjectRows],
	);
	useEffect(() => {
		if (!cloudLayout || !sidebarProjectRowsReady) return;
		for (const repoProject of cloudLayout.repoProjects) {
			if (!sidebarProjectRowsById.has(repoProject.id)) {
				ensureProjectInSidebar(repoProject.id);
			}
		}
	}, [
		cloudLayout,
		sidebarProjectRowsReady,
		sidebarProjectRowsById,
		ensureProjectInSidebar,
	]);

	const groupsWithCloud = useMemo<DashboardSidebarProject[]>(() => {
		if (!cloudLayout) return computedGroups;
		const withCloud = computedGroups.map((project) => {
			const cloudWorkspaces = cloudLayout.byProjectId.get(project.id);
			return cloudWorkspaces ? { ...project, cloudWorkspaces } : project;
		});
		const repoGroups = cloudLayout.repoProjects.flatMap(
			(repoProject): DashboardSidebarProject[] => {
				const row = sidebarProjectRowsById.get(repoProject.id);
				if (row?.isHidden) return [];
				return [
					{
						...repoProject,
						color: null,
						isCollapsed: row?.isCollapsed ?? false,
						children: [],
						kind: "cloud-repo",
					},
				];
			},
		);
		// Placement order where a row exists; a repo project seen for the
		// first time trails until its row lands.
		const orderIndexById = new Map(
			orderedSidebarProjectRows.map((row, index) => [row.projectId, index]),
		);
		const orderOf = (project: DashboardSidebarProject) =>
			orderIndexById.get(project.id) ?? Number.MAX_SAFE_INTEGER;
		return [...withCloud, ...repoGroups].sort(
			(left, right) => orderOf(left) - orderOf(right),
		);
	}, [
		cloudLayout,
		computedGroups,
		sidebarProjectRowsById,
		orderedSidebarProjectRows,
	]);
	const groups = useStableDashboardSidebarProjects(groupsWithCloud);

	const hiddenRepoProjects = useMemo<DashboardSidebarHiddenProject[]>(
		() =>
			(cloudLayout?.repoProjects ?? []).flatMap((repoProject) =>
				sidebarProjectRowsById.get(repoProject.id)?.isHidden
					? [
							{
								id: repoProject.id,
								name: repoProject.name,
								iconUrl: repoProject.iconUrl,
								color: null,
							},
						]
					: [],
			),
		[cloudLayout, sidebarProjectRowsById],
	);
	const allHiddenProjects = useMemo(
		() =>
			hiddenRepoProjects.length === 0
				? hiddenProjects
				: [...hiddenProjects, ...hiddenRepoProjects],
		[hiddenProjects, hiddenRepoProjects],
	);

	const computedSessions = useMemo(
		() =>
			buildDashboardSidebarSessions({
				sessionSidebarWorkspaces: sessionRows,
				sidebarSections,
				machineId,
				pullRequestsByWorkspaceId,
			}),
		[machineId, pullRequestsByWorkspaceId, sessionRows, sidebarSections],
	);
	const sessions = useJsonStable(computedSessions);
	const sessionWorkspaces = sessions.workspaces;

	const computedPinnedWorkspaces = useMemo<DashboardSidebarPinnedWorkspace[]>(
		() =>
			buildDashboardSidebarPinnedWorkspaces({
				pinnedSidebarWorkspaces: pinnedRows,
				sidebarProjects,
				machineId,
				pullRequestsByWorkspaceId,
			}),
		[machineId, pinnedRows, pullRequestsByWorkspaceId, sidebarProjects],
	);
	const pinnedWorkspaces = useJsonStable(computedPinnedWorkspaces);

	return {
		groups,
		hiddenProjects: allHiddenProjects,
		pinnedWorkspaces,
		sessionWorkspaces,
		sessionChildren: sessions.children,
		githubStatus,
		refreshWorkspacePullRequest,
		toggleProjectCollapsed,
	};
}
