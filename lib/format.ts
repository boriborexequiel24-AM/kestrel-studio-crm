const DAY = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "3 days ago", "5 months ago", "2 years ago". */
export function agoLabel(date: Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(days / 365.25)} years ago`;
}

export function fullName(owner: { firstName: string; lastName: string }): string {
  return `${owner.firstName} ${owner.lastName}`;
}
