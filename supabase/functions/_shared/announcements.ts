export function announcementMatchesClass(targetClass: string | null | undefined, studentClass: string) {
  return !targetClass || targetClass === studentClass;
}
