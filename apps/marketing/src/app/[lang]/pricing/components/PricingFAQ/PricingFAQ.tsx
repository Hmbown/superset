"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import type { PlanFamily } from "@superset/shared/billing";
import { FAQDisclosure } from "../../../components/FAQDisclosure";
import { PRICING_FAQ_ITEMS } from "../../constants";
import { planPriceValues } from "../../utils/planPriceValues";

interface PricingFAQProps {
	catalog: PlanFamily[];
}

export function PricingFAQ({ catalog }: PricingFAQProps) {
	const { t, i18n } = useLingui();
	const { planPrices, allowances, overagePrice } = planPriceValues(
		catalog,
		i18n,
	);
	const values = { planPrices, allowances, overagePrice };

	return (
		<div>
			<span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
				<Trans>FAQ</Trans>
			</span>
			<h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mt-4 mb-8">
				<Trans>Common questions</Trans>
			</h2>
			<div>
				{PRICING_FAQ_ITEMS.map((item) => (
					<FAQDisclosure
						key={item.id}
						name="pricing-faq"
						compact
						question={t(item.question)}
					>
						<p>{i18n._({ ...item.answer, values })}</p>
					</FAQDisclosure>
				))}
			</div>
		</div>
	);
}
