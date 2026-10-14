import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { DashboardSidebarWorkspaceLeadIndicator } from "./DashboardSidebarWorkspaceLeadIndicator";

afterEach(cleanup);

function renderLead(
	props: Partial<Parameters<typeof DashboardSidebarWorkspaceLeadIndicator>[0]>,
) {
	return render(
		<DashboardSidebarWorkspaceLeadIndicator
			workspaceStatus={null}
			isCreatePending={false}
			pullRequestState={null}
			{...props}
		/>,
	).container;
}

test("live agent state outranks the pull request", () => {
	const working = renderLead({
		workspaceStatus: "working",
		pullRequestState: "open",
	});
	expect(working.querySelector(".text-emerald-500")).toBeNull();
	expect(working.querySelectorAll("span > span")).toHaveLength(9);
	cleanup();

	const needsInput = renderLead({
		workspaceStatus: "permission",
		pullRequestState: "open",
	});
	expect(needsInput.querySelector(".bg-yellow-500")).not.toBeNull();
	expect(needsInput.querySelector(".text-emerald-500")).toBeNull();
});

test("an idle row shows its pull request state, else the quiet ring", () => {
	expect(
		renderLead({ pullRequestState: "merged" }).querySelector(
			".text-purple-500",
		),
	).not.toBeNull();
	cleanup();

	const idle = renderLead({});
	expect(idle.querySelector("svg")?.getAttribute("class")).toContain(
		"text-muted-foreground/40",
	);
});

test("a dead or unborn sandbox outranks the agent and the PR", () => {
	const failed = renderLead({
		sandboxStatus: "failed",
		workspaceStatus: "working",
		pullRequestState: "open",
	});
	expect(failed.querySelector(".bg-red-500")).not.toBeNull();
	expect(failed.querySelectorAll("span > span")).not.toHaveLength(9);
	cleanup();

	const provisioning = renderLead({
		sandboxStatus: "provisioning",
		pullRequestState: "open",
	});
	expect(provisioning.querySelectorAll("span > span")).toHaveLength(9);
	expect(provisioning.querySelector(".text-emerald-500")).toBeNull();
});
