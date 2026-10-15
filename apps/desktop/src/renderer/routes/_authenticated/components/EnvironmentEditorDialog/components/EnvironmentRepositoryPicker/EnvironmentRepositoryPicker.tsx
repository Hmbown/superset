import { Trans, useLingui } from "@lingui/react/macro";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@superset/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { HiCheck, HiChevronUpDown } from "react-icons/hi2";
import { LuRefreshCw } from "react-icons/lu";

interface RepositoryOption {
	id: string;
	fullName: string;
}

interface EnvironmentRepositoryPickerProps {
	repositories: RepositoryOption[];
	selected: RepositoryOption[];
	onToggle: (repositoryId: string) => void;
	isLoading: boolean;
	disabled: boolean;
	onConfigureGitHubApp: (() => void) | null;
	onRefresh: (() => void) | null;
	isRefreshing: boolean;
}

/** The repository row of the property list; opens a searchable multi-select. */
export function EnvironmentRepositoryPicker({
	repositories,
	selected,
	onToggle,
	isLoading,
	disabled,
	onConfigureGitHubApp,
	onRefresh,
	isRefreshing,
}: EnvironmentRepositoryPickerProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	const selectedIds = new Set(selected.map((repository) => repository.id));

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					className="flex h-10 w-full min-w-0 items-center justify-between gap-2 px-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={disabled}
					id="environment-repositories"
					type="button"
				>
					<span className="flex min-w-0 items-center gap-2">
						<FaGithub className="size-3.5 shrink-0 text-muted-foreground" />
						<span
							className={cn(
								"truncate",
								selected.length === 0 && "text-muted-foreground",
							)}
						>
							{selected.length === 0
								? t({ message: "Choose a repository" })
								: selected.map((repository) => repository.fullName).join(", ")}
						</span>
					</span>
					{!disabled && (
						<HiChevronUpDown className="size-4 shrink-0 text-muted-foreground" />
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[var(--radix-popover-trigger-width)] p-0"
			>
				<Command>
					<CommandInput
						placeholder={t({ message: "Search repositories..." })}
					/>
					<CommandList className="max-h-64">
						<CommandEmpty className="px-3 py-4 text-center text-xs text-muted-foreground">
							{isLoading ? (
								<Trans>Loading repositories...</Trans>
							) : onConfigureGitHubApp ? (
								<Trans>No matching repositories.</Trans>
							) : (
								<Trans>
									No repositories. Connect GitHub in Integrations, then refresh.
								</Trans>
							)}
						</CommandEmpty>
						{repositories.length > 0 && (
							<CommandGroup>
								{repositories.map((repository) => (
									<CommandItem
										key={repository.id}
										onSelect={() => onToggle(repository.id)}
										value={repository.fullName}
									>
										<FaGithub className="size-3.5 text-muted-foreground" />
										<span className="flex-1 truncate">
											{repository.fullName}
										</span>
										{selectedIds.has(repository.id) && (
											<HiCheck className="size-4 shrink-0" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{(onRefresh || onConfigureGitHubApp) && (
							<>
								<CommandSeparator alwaysRender />
								<CommandGroup forceMount>
									{onRefresh && (
										<CommandItem
											disabled={isRefreshing}
											forceMount
											onSelect={onRefresh}
										>
											<LuRefreshCw
												className={cn(
													"size-3.5",
													isRefreshing && "animate-spin",
												)}
											/>
											<Trans>Refresh repositories</Trans>
										</CommandItem>
									)}
									{onConfigureGitHubApp && (
										<CommandItem
											forceMount
											onSelect={() => {
												setOpen(false);
												onConfigureGitHubApp();
											}}
										>
											<FaGithub className="size-3.5" />
											<Trans>Configure GitHub App…</Trans>
										</CommandItem>
									)}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
