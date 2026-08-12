export function followupDue(followUpAt?: string, followedUp?: boolean): boolean {
  if (!followUpAt || followedUp) return false;
  return new Date(followUpAt).getTime() <= Date.now();
}

export function followupDaysLeft(followUpAt?: string): number {
  if (!followUpAt) return 0;
  return Math.max(0, Math.ceil((new Date(followUpAt).getTime() - Date.now()) / 86400000));
}
