import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { PlanFamily } from "@superset/shared/billing";
import { COMPANY } from "@superset/shared/constants";

export interface PricingFeature {
	id: string;
	label: MessageDescriptor;
}

export interface PricingTier {
	id: string;
	name: MessageDescriptor | string;
	description: MessageDescriptor;
	price:
		| { kind: "fixed"; display: string; note: MessageDescriptor }
		| {
				kind: "seat";
				family: PlanFamily;
				note: MessageDescriptor;
				monthlyCadence: MessageDescriptor;
				yearlyCadence: MessageDescriptor;
		  }
		| { kind: "custom"; display: MessageDescriptor; note: MessageDescriptor };
	features: PricingFeature[];
	cta: {
		label: MessageDescriptor;
		href: string;
		event: "download_clicked" | "contact_sales_clicked" | "checkout_clicked";
		variant: "default" | "outline" | "secondary";
		external?: boolean;
	};
	ctaNote?: { label: MessageDescriptor; href?: string };
	highlight?: boolean;
}

export const FREE_TIER: PricingTier = {
	id: "free",
	name: msg({ message: "Free" }),
	description: msg({
		message: "For individuals getting started",
	}),
	price: {
		kind: "fixed",
		display: "$0",
		note: msg({
			message: "Free for everyone",
		}),
	},
	features: [
		{
			id: "users",
			label: msg({
				message: "1 user",
			}),
		},
		{
			id: "localWorkspaces",
			label: msg({
				message: "Local workspaces",
			}),
		},
		{
			id: "desktopApp",
			label: msg({
				message: "Desktop app",
			}),
		},
		{
			id: "cli",
			label: msg({
				message: "CLI",
			}),
		},
	],
	cta: {
		label: msg({
			message: "Download app",
		}),
		href: "/download",
		event: "download_clicked",
		variant: "outline",
	},
	ctaNote: {
		label: msg({
			message: "No credit card required.",
		}),
	},
};

export const ENTERPRISE_TIER: PricingTier = {
	id: "enterprise",
	name: msg({
		message: "Enterprise",
	}),
	description: msg({
		message: "For organizations with advanced needs",
	}),
	price: {
		kind: "custom",
		display: msg({
			message: "Custom pricing",
		}),
		note: msg({
			message: "Annual billing only",
		}),
	},
	features: [
		{
			id: "everythingInPro",
			label: msg({
				message: "Everything in Pro",
			}),
		},
		{
			id: "ssoScim",
			label: msg({
				message: "SAML SSO & SCIM provisioning",
			}),
		},
		{
			id: "auditLogs",
			label: msg({
				message: "Audit logs",
			}),
		},
		{
			id: "soc2",
			label: msg({
				message: "SOC 2 Type II report",
			}),
		},
		{
			id: "slaSupport",
			label: msg({
				message: "Uptime SLA & dedicated support",
			}),
		},
		{
			id: "customIntegrations",
			label: msg({
				message: "Custom integrations",
			}),
		},
	],
	cta: {
		label: msg({
			message: "Contact sales",
		}),
		href: "/enterprise",
		event: "contact_sales_clicked",
		variant: "outline",
	},
	ctaNote: {
		label: msg({
			message: "Review our security",
		}),
		href: COMPANY.TRUST_URL,
	},
};

const FAMILY_DESCRIPTIONS: Record<string, MessageDescriptor> = {
	pro: msg({ message: "For teams that need more power" }),
	team: msg({ message: "For teams that run agents every day" }),
	ultra: msg({ message: "For people who keep agents running all day" }),
};

const GENERIC_DESCRIPTION = msg({
	message: "For teams that run more agents in the cloud",
});

const BASE_FEATURES: PricingFeature[] = [
	{
		id: "everythingInFree",
		label: msg({
			message: "Everything in Free",
		}),
	},
	{
		id: "cloudHours",
		label: msg({
			message: "{gbHours} cloud GB-hours per seat each month",
		}),
	},
	{
		id: "unlimitedUsers",
		label: msg({
			message: "Unlimited users",
		}),
	},
	{
		id: "remoteAccess",
		label: msg({
			message: "Remote access",
		}),
	},
	{
		id: "automations",
		label: msg({
			message: "Automations",
		}),
	},
	{
		id: "linearIntegration",
		label: msg({
			message: "Linear integration",
		}),
	},
	{
		id: "slackIntegration",
		label: msg({
			message: "Slack integration",
		}),
	},
	{
		id: "mobile",
		label: msg({
			message: "Mobile",
		}),
	},
];

const STEP_UP_FEATURES: PricingFeature[] = [
	{
		id: "everythingInPrevious",
		label: msg({ message: "Everything in {previousPlan}" }),
	},
	{
		id: "cloudHours",
		label: msg({ message: "{gbHours} cloud GB-hours per seat each month" }),
	},
	{
		id: "cloudMultiple",
		label: msg({ message: "{multiple}x the cloud GB-hours of {basePlan}" }),
	},
	{
		id: "sharedCloudPool",
		label: msg({ message: "One shared GB-hour pool for the team" }),
	},
];

const SEAT_PRICE = {
	note: msg({ message: "per user/month" }),
	monthlyCadence: msg({ message: "Billed monthly" }),
	yearlyCadence: msg({ message: "{yearlyTotal} per user, billed yearly" }),
};

export function pricingTiers(catalog: PlanFamily[]): PricingTier[] {
	return [
		FREE_TIER,
		...catalog.map(
			(family, index): PricingTier => ({
				id: family.family,
				name: family.name,
				description: FAMILY_DESCRIPTIONS[family.family] ?? GENERIC_DESCRIPTION,
				price: { kind: "seat", family, ...SEAT_PRICE },
				features: index === 0 ? BASE_FEATURES : STEP_UP_FEATURES,
				cta: {
					label: msg({ message: "Get {plan}" }),
					href: "/settings/billing",
					event: "checkout_clicked",
					variant: index === 0 ? "default" : "outline",
				},
				highlight: index === 0,
			}),
		),
		ENTERPRISE_TIER,
	];
}

// Plain strings stay raw numerals ("1"); anything with words is a descriptor.
export type ComparisonValue = string | boolean | MessageDescriptor;

export interface ComparisonRow {
	id: string;
	label: MessageDescriptor;
	values: [
		free: ComparisonValue | null,
		paid: ComparisonValue | null,
		enterprise: ComparisonValue | null,
	];
	cloudGbHours?: boolean;
	badge?: {
		label: MessageDescriptor;
		variant: "default" | "secondary";
	};
}

export interface ComparisonSection {
	id: string;
	title: MessageDescriptor;
	rows: ComparisonRow[];
}

const UNLIMITED = msg({
	message: "Unlimited",
});

export const COMPARISON_SECTIONS: ComparisonSection[] = [
	{
		id: "usage",
		title: msg({
			message: "Usage",
		}),
		rows: [
			{
				id: "teamMembers",
				label: msg({
					message: "Team members",
				}),
				values: ["1", UNLIMITED, UNLIMITED],
			},
			{
				id: "workspaces",
				label: msg({
					message: "Workspaces",
				}),
				values: [UNLIMITED, UNLIMITED, UNLIMITED],
			},
			{
				id: "projects",
				label: msg({
					message: "Projects",
				}),
				values: [UNLIMITED, UNLIMITED, UNLIMITED],
			},
			{
				id: "cloudGbHours",
				label: msg({
					message: "Cloud GB-hours per seat each month",
				}),
				values: [null, null, msg({ message: "Custom" })],
				cloudGbHours: true,
			},
		],
	},
	{
		id: "features",
		title: msg({
			message: "Features",
		}),
		rows: [
			{
				id: "desktopApp",
				label: msg({
					message: "Desktop app",
				}),
				values: [true, true, true],
			},
			{
				id: "localWorkspaces",
				label: msg({
					message: "Local workspaces",
				}),
				values: [true, true, true],
			},
			{
				id: "remoteAccess",
				label: msg({
					message: "Remote access",
				}),
				values: [null, true, true],
			},
			{
				id: "automations",
				label: msg({
					message: "Automations",
				}),
				values: [null, true, true],
			},
			{
				id: "mobileApp",
				label: msg({
					message: "Mobile app",
				}),
				values: [null, true, true],
			},
			{
				id: "linearIntegration",
				label: msg({
					message: "Linear integration",
				}),
				values: [null, true, true],
			},
			{
				id: "slackIntegration",
				label: msg({
					message: "Slack integration",
				}),
				values: [null, true, true],
			},
			{
				id: "teamCollaboration",
				label: msg({
					message: "Team collaboration",
				}),
				values: [null, true, true],
			},
		],
	},
	{
		id: "support",
		title: msg({
			message: "Support",
		}),
		rows: [
			{
				id: "prioritySupport",
				label: msg({
					message: "Priority support",
				}),
				values: [null, null, true],
			},
			{
				id: "uptimeSla",
				label: msg({
					message: "Uptime SLA",
				}),
				values: [null, null, true],
			},
			{
				id: "customContracts",
				label: msg({
					message: "Custom contracts",
				}),
				values: [null, null, true],
			},
		],
	},
	{
		id: "security",
		title: msg({
			message: "Security",
		}),
		rows: [
			{
				id: "sso",
				label: msg({
					message: "SSO/SAML",
				}),
				values: [null, null, true],
			},
			{
				id: "ipRestrictions",
				label: msg({
					message: "IP restrictions",
				}),
				values: [null, null, true],
			},
			{
				id: "scim",
				label: msg({
					message: "SCIM provisioning",
				}),
				values: [null, null, true],
			},
			{
				id: "auditLog",
				label: msg({
					message: "Audit log",
				}),
				values: [null, null, true],
			},
			{
				id: "soc2",
				label: msg({
					message: "SOC 2 Type II report",
				}),
				values: [null, null, true],
			},
		],
	},
];

export interface PricingFAQItem {
	id: string;
	question: MessageDescriptor;
	answer: MessageDescriptor;
}

export const PRICING_FAQ_ITEMS: PricingFAQItem[] = [
	{
		id: "freePlan",
		question: msg({
			message: "Is there a free plan?",
		}),
		answer: msg({
			message:
				"Yes. Free covers individuals with 1 user, local workspaces, the desktop app, and the CLI. No credit card required.",
		}),
	},
	{
		id: "proPricing",
		question: msg({
			message: "How do the paid plans work?",
		}),
		answer: msg({
			message:
				"Paid plans are priced per user per month and billed for each active seat on your team. {planPrices}.",
		}),
	},
	{
		id: "cloudGbHours",
		question: msg({
			message: "What are cloud GB-hours?",
		}),
		answer: msg({
			message:
				"Cloud workspaces are metered in GB-hours: the memory of the box times the hours it runs. An 8 GB box uses 8 GB-hours per hour. Each seat adds its plan's GB-hours to one pool your team shares: {allowances}. The pool resets every month, and usage past it is billed per GB-hour at the rate shown on each plan.",
		}),
	},
	{
		id: "switchPlans",
		question: msg({
			message: "Can I switch plans or cancel anytime?",
		}),
		answer: msg({
			message:
				"Yes. You can upgrade, downgrade, or cancel at any time from the billing settings inside the app. Changes take effect at the end of your current billing period.",
		}),
	},
	{
		id: "enterpriseIncludes",
		question: msg({
			message: "What's included in Enterprise?",
		}),
		answer: msg({
			message:
				"Everything in Pro plus SSO & SAML, SCIM provisioning, IP restrictions, audit logs, a custom SLA, dedicated support, and custom contracts. Pricing is tailored to your organization. Get in touch and we'll scope something that fits.",
		}),
	},
	{
		id: "soc2",
		question: msg({
			message: "Is Superset SOC 2 compliant?",
		}),
		answer: msg({
			message:
				"Yes. Superset has completed a SOC 2 Type II audit with an independent auditor, covering our security controls in operation over time. Request the report and review our security documentation at trust.superset.sh.",
		}),
	},
	{
		id: "whereCodeRuns",
		question: msg({
			message: "Where does my code run?",
		}),
		answer: msg({
			message:
				"On your machine. Repos, worktrees, terminal output, and agent sessions stay local by default; cloud sync covers account and organization metadata only. Superset doesn't proxy any API calls.",
		}),
	},
	{
		id: "agentSubscriptions",
		question: msg({
			message: "Do I need my own coding agent subscriptions?",
		}),
		answer: msg({
			message:
				"Yes. Superset is the workspace your agents run in, not a model provider. Bring Claude Code, Codex, OpenCode, or any CLI agent, and use your existing accounts or API keys on every plan.",
		}),
	},
];
