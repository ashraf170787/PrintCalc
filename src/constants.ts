import { PrintZone, BagSpecs } from './types';

export const INITIAL_BAG_SPECS: BagSpecs = {
  width: 260,
  height: 300,
  unit: 'mm',
};

export const INITIAL_ZONES: PrintZone[] = [
  {
    id: 'front-logo',
    name: 'George School Logo',
    type: 'rectangle',
    width: 57,
    height: 23,
    x: 101.5, // (260 - 57) / 2
    y: 60,
    side: 'front',
    color: '#141414',
  },
  {
    id: 'front-bottom-block',
    name: 'Front Main Panel',
    type: 'rectangle',
    width: 260,
    height: 161.5,
    x: 0,
    y: 300 - 161.5 - 5, // 5mm bottom margin
    side: 'front',
    color: '#004B6D', // Pantone 541 C approx
  },
  {
    id: 'reverse-main-block',
    name: 'Reverse Main Panel',
    type: 'rectangle',
    width: 260,
    height: 250,
    x: 0,
    y: 300 - 250 - 5,
    side: 'reverse',
    color: '#008B7D', // Pantone 3282 C approx
  },
];
