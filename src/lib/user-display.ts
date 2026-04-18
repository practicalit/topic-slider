/** Session / navbar label: volunteers with a display name show as volunteer+{name}. */
export function sessionDisplayName(user: {
  username: string;
  displayName: string | null;
  role: string;
}): string {
  if (user.role === "VOLUNTEER" && user.displayName?.trim()) {
    return `volunteer+${user.displayName.trim()}`;
  }
  return user.username;
}
