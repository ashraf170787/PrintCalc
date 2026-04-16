export type ZoneType = 'rectangle' | 'circle';

export interface PrintZone {
  id: string;
  name: string;
  type: ZoneType;
  width: number;
  height: number;
  x: number;
  y: number;
  side: 'front' | 'reverse';
  color?: string;
}

export interface BagSpecs {
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'in';
  artworkUrl?: string;
  isPdf?: boolean;
}
