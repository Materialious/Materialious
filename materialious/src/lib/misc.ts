export function truncate(value: string, maxLength: number = 50): string {
  return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}