import humanNumber from "human-number";

export function truncate(value: string, maxLength: number = 50): string {
  return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}

export function numberWithCommas(number: number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function cleanNumber(number: number): string {
  return humanNumber(number, (number: number) => Number.parseFloat(number.toString()).toFixed(1));
}