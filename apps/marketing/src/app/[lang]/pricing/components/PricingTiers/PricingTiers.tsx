"use client";

import { useLingui } from "@lingui/react/macro";
import type { PlanFamily } from "@superset/shared/billing";
import { useState } from "react";
import { pricingTiers } from "../../constants";
import { planPriceValues } from "../../utils/planPriceValues";
import { BillingToggle } from "./components/BillingToggle";
import { PricingCard } from "./components/PricingCard";

const GRID_COLUMNS: Record<number, string> = {
	2: "lg:grid-cols-2",
	3: "lg:grid-cols-3",
	4: "lg:grid-cols-4",
	5: "lg:grid-cols-5",
};

interface PricingTiersProps {
	catalog: PlanFamily[];
}

export function PricingTiers({ catalog }: PricingTiersProps) {
	const { i18n } = useLingui();
	const [isYearly, setIsYearly] = useState(true);
	const values = planPriceValues(catalog, i18n);
	const tiers = pricingTiers(catalog);
	const columns = GRID_COLUMNS[Math.min(5, tiers.length - 1)] ?? "";

	return (
		<div className="flex flex-col gap-10">
			{values.maxDiscount && (
				<div className="flex justify-center">
					<BillingToggle
						isYearly={isYearly}
						onChange={setIsYearly}
						maxDiscount={values.maxDiscount}
					/>
				</div>
			)}
			<div className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${columns}`}>
				{tiers.map((tier) => (
					<PricingCard
						key={tier.id}
						tier={tier}
						isYearly={isYearly}
						values={values}
						wide={tier.price.kind === "custom"}
					/>
				))}
			</div>
		</div>
	);
}
