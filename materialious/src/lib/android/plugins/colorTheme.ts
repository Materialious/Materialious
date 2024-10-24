import { registerPlugin } from "@capacitor/core";

export interface ColorTheme {
  getColorPalette: () => Promise<{
    primary: number;
    onPrimary: number;
    secondary: number;
    accent: number;
  }>;
}

export function convertToHexColorCode(color: number): string {
  // Convert the negative number to a positive unsigned integer
  const unsignedColor = color < 0 ? color + 0x100000000 : color;

  // Extract the RGB components
  const r = (unsignedColor >> 16) & 0xff;
  const g = (unsignedColor >> 8) & 0xff;
  const b = unsignedColor & 0xff;

  // Convert to hex format and pad with zeros if necessary
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}


const colorTheme = registerPlugin<ColorTheme>('ColorTheme');

export default colorTheme;