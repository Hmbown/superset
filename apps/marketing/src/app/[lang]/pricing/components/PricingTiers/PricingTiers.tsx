"use client";

import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { PRICING_TIERS } from "../../constants";
import type { PlanPrices } from "../../utils/planPricesFromAutumn";
import { planPriceValues } from "../../utils/planPriceValues";
import { BillingToggle } from "./components/BillingToggle";
import { PricingCard } from "./components/PricingCard";

interface PricingTiersProps {
	prices: PlanPrices;
}

export function PricingTiers({ prices }: PricingTiersProps) {
	const { i18n } = useLingui();
	const [isYearly, setIsYearly] = useState(true);
	const { maxDiscount } = planPriceValues(prices, i18n.locale);

	return (
		<div className="flex flex-col gap-10">
			<div className="flex justify-center">
				<BillingToggle
					isYearly={isYearly}
					onChange={setIsYearly}
					maxDiscount={maxDiscount}
				/>
			</div>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				{PRICING_TIERS.map((tier) => (
					<PricingCard
						key={tier.id}
						tier={tier}
						isYearly={isYearly}
						prices={prices}
						wide={tier.id === "enterprise"}
					/>
				))}
			</div>
		</div>
	);
}
