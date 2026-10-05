/** Stable anonymous label — never expose email/name in betting UI. */
export function anonymousTrader(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return `Anon-${(hash % 10000).toString().padStart(4, "0")}`;
}
