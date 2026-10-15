interface EnvironmentWithRepositories {
	repositories?: ReadonlyArray<{ fullName: string }> | null;
}

/**
 * The environments that check out `repositoryFullName`, those that open on it
 * first. A null repository keeps every environment.
 */
export function environmentsForRepository<
	T extends EnvironmentWithRepositories,
>(environments: T[], repositoryFullName: string | null): T[] {
	if (!repositoryFullName) return environments;
	const key = repositoryFullName.toLowerCase();
	const position = (environment: T) =>
		(environment.repositories ?? []).findIndex(
			(repository) => repository.fullName.toLowerCase() === key,
		);
	const carrying = environments.filter(
		(environment) => position(environment) >= 0,
	);
	const primary = carrying.filter((environment) => position(environment) === 0);
	const secondary = carrying.filter((environment) => position(environment) > 0);
	return [...primary, ...secondary];
}
