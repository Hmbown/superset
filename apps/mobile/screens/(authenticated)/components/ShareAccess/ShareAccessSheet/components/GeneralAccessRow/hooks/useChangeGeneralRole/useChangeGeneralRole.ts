import { useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import * as Haptics from "expo-haptics";
import { Alert } from "react-native";
import type { GeneralAccess } from "../../../../../types";

/** Changes what general access lets people do, saying so when it fails. */
export function useChangeGeneralRole(general: GeneralAccess) {
	const { t } = useLingui();
	return async (next: string) => {
		const role = general.role;
		if (!role || next === role.value) return;
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		try {
			await role.onChange(next);
		} catch (error) {
			Alert.alert(
				errorMessage(error, t({ message: "Could not change access" })),
			);
		}
	};
}
