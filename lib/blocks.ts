// The five demo blocks (areas) and their approximate centre points.
// These are illustrative demo coordinates, not survey data.
export type Block = { name: string; lat: number; lng: number };

export const BLOCKS: Block[] = [
  { name: "Hamirpur", lat: 31.686, lng: 76.521 },
  { name: "Nadaun", lat: 31.783, lng: 76.35 },
  { name: "Bhoranj", lat: 31.65, lng: 76.69 },
  { name: "Sujanpur", lat: 31.835, lng: 76.505 },
  { name: "Barsar", lat: 31.575, lng: 76.405 },
];

// Find a block by name. Returns undefined if the name is not in the list.
export function findBlock(name: string): Block | undefined {
  return BLOCKS.find((b) => b.name === name);
}
