/** `2026-10-25 18:52` as the deck shows it: the time alone today, else the day as well. */
export function addedAtLabel(addedAt: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(addedAt);
  if (!match) return addedAt;
  const [, year, month, day, time] = match;
  const sameDay =
    Number(year) === now.getFullYear() && Number(month) === now.getMonth() + 1 && Number(day) === now.getDate();
  if (sameDay) return time;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${months[Number(month) - 1]} ${time}`;
}
