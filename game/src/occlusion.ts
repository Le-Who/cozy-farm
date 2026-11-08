import type { IslandId } from './farm';

export type Occluder = { url: string; x: number; y: number; w: number; h: number; footY: number };

const asset = (name: string) => `${import.meta.env.BASE_URL}art/${name}.webp`;

// Bounds place masked plate pixels back at their original world coordinates.
export const occluders: Record<IslandId, readonly Occluder[]> = {
  village: [],
  home: [
    { url: asset('home-occluder-farmhouse'), x: 213.2325, y: 122.65, w: 247.53, h: 266.06, footY: 385.3633 },
    { url: asset('home-occluder-well'), x: 575.3288, y: 206.3167, w: 107.04, h: 152.2733, footY: 356.08 },
    { url: asset('home-occluder-mill'), x: 756.795, y: 110.1, w: 128.7825, h: 216.6967, footY: 323.45 },
    { url: asset('home-occluder-market'), x: 988.4363, y: 226.3967, w: 236.6588, h: 173.19, footY: 397.0767 },
    { url: asset('home-occluder-coop'), x: 227.4488, y: 407.1167, w: 128.7825, h: 184.0667, footY: 588.6733 },
    { url: asset('home-occluder-pen-front'), x: 168.9112, y: 610.4267, w: 256.7287, h: 71.9533, footY: 677.36 },
    { url: asset('home-occluder-pen-left-near'), x: 174.765, y: 557.7167, w: 35.1225, h: 70.28, footY: 626.3233 },
    { url: asset('home-occluder-pen-right-near'), x: 388.845, y: 559.39, w: 33.45, h: 64.4233, footY: 623.8133 },
    { url: asset('home-occluder-pen-left-side'), x: 186.4725, y: 481.58, w: 31.7775, h: 98.7267, footY: 582.8167 },
    { url: asset('home-occluder-pen-right-side'), x: 377.9737, y: 482.4167, w: 32.6138, h: 99.5633, footY: 583.6533 },
  ],
  grove: [
    { url: asset('grove-occluder-left-tree'), x: 239.7086, y: 195.4396, w: 161.2286, h: 180.7929, footY: 371.9886 },
    { url: asset('grove-occluder-inner-left-tree'), x: 465.4286, y: 165.7319, w: 141.7114, h: 155.3291, footY: 318.5146 },
    { url: asset('grove-occluder-inner-right-tree'), x: 725.94, y: 161.4879, w: 162.9257, h: 168.061, footY: 327.0025 },
    { url: asset('grove-occluder-right-tree'), x: 960.9943, y: 231.0889, w: 168.8657, h: 179.9441, footY: 408.4867 },
    { url: asset('grove-occluder-center-rocks'), x: 612.2314, y: 623.2313, w: 126.4371, h: 60.2643, footY: 680.9492 },
    { url: asset('grove-occluder-east-rocks'), x: 1094.22, y: 509.493, w: 155.2886, h: 75.5426, footY: 584.1868 },
  ],
  cape: [],
};
