const FILE_MUTATION_RE =
  /(?:^|[;&|(`\n])\s*(?:sudo\s+)?(?:\/(?:usr\/)?bin\/)?(?:rm|mv)\b|(?:^|[;&|(`\n])\s*git\s+(?:rm|mv)\b/i;

export function isBlockedWorkspaceMutationCommand(command: string): boolean {
  return FILE_MUTATION_RE.test(command.trim());
}

export function blockedWorkspaceMutationMessage(): string {
  return "Do not delete or move files with run_terminal. Use delete_files or move_files.";
}
