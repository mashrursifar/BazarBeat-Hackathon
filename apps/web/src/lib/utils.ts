export function cn(...classNames: (string | undefined | false)[]): string {
  return classNames.filter(Boolean).join(" ");
}
