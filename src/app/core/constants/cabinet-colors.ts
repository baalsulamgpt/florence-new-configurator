export interface CabinetColor {
  name: string;
  hex: string;
  textFill: string;
}

export const CABINET_COLORS: CabinetColor[] = [
  { name: 'Silver Speck', hex: '#dbe0eb', textFill: '#555' },
  { name: 'Antique Bronze', hex: '#8b7355', textFill: '#fff' },
  { name: 'Black', hex: '#1a1a1a', textFill: '#fff' },
  { name: 'Dark Bronze', hex: '#4a3728', textFill: '#fff' },
  { name: 'Gold Speck', hex: '#d4af37', textFill: '#333' },
  { name: 'Postal Gray', hex: '#708090', textFill: '#fff' },
  { name: 'White', hex: '#ffffff', textFill: '#333' },
  { name: 'Standalone', hex: '#c0c0c0', textFill: '#333' }
];

/**
 * Get text fill color for a given cabinet color hex
 * @param cabinetColor - The hex color of the cabinet
 * @returns The appropriate text fill color (defaults to #555)
 */
export function getTextFillForCabinetColor(cabinetColor: string): string {
  const color = CABINET_COLORS.find(c => c.hex.toLowerCase() === cabinetColor.toLowerCase());
  return color ? color.textFill : '#555';
}
