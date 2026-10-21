"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { FAQDisclosure } from "../../../components/FAQDisclosure";
import { PRICING_FAQ_ITEMS } from "../../constants";
import type { PlanPrices } from "../../utils/planPricesFromAutumn";
import { planPriceValues } from "../../utils/planPriceValues";

interface PricingFAQProps {
	prices: PlanPrices;
}

export function PricingFAQ({ prices }: PricingFAQProps) {
	const { t, i18n } = useLingui();
	const values = planPriceValues(prices, i18n.locale);

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
