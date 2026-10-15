import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
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
		<div className="flex items-center gap-1.5">
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger asChild>
					<Button
						className="h-9 flex-1 justify-between gap-2 px-3 font-normal"
						disabled={disabled}
						id="environment-repositories"
						variant="outline"
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
									: selected
											.map((repository) => repository.fullName)
											.join(", ")}
							</span>
						</span>
						<HiChevronUpDown className="size-4 shrink-0 opacity-50" />
					</Button>
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
										No repositories. Connect GitHub in Integrations, then
										refresh.
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
							{onConfigureGitHubApp && (
								<>
									<CommandSeparator alwaysRender />
									<CommandGroup forceMount>
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
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{onRefresh && (
				<Button
					aria-label={t({ message: "Refresh repositories" })}
					className="size-9 shrink-0"
					disabled={isRefreshing || disabled}
					onClick={onRefresh}
					size="icon"
					title={t({ message: "Refresh repositories" })}
					variant="ghost"
				>
					<LuRefreshCw
						className={cn(
							"size-3.5 text-muted-foreground",
							isRefreshing && "animate-spin",
						)}
					/>
				</Button>
			)}
		</div>
	);
}
