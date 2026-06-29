export interface Skill {
  id?: string;
  name: string;
  level?: string;
  type: "PDMG" | "MDMG" | "Support" | "Passive";
  percentage: string;
  cooldown: string;
  castTime: string;
  spCost: string;
  description: string;
  alternativeDescription?: string;
  job?: string; // Filterable job class (e.g. Archer, Swordsman, Mage, Acolyte, Thief, Merchant, Bard/Dancer)
  imageBase64?: string;
  createdAt?: number;
}

export interface Patch {
  id?: string;
  title: string;
  date: string;
  content: string;
  tags: string[];
  author: string;
  imageBase64?: string;
  createdAt?: number;
}

export interface MapData {
  id?: string;
  name: string;
  minLevel: number;
  monsterList: string[];
  description: string;
  imageBase64?: string;
  createdAt?: number;
}

export interface CardData {
  id?: string;
  name: string;
  slot: "Weapon" | "Armor" | "Garment" | "Shoes" | "Accessory" | "Headwear" | string;
  effect: string;
  stats: string;
  sourceMonster: string;
  lvl5Effect?: string;  // Upgrade Level 5 Effect
  lvl10Effect?: string; // Upgrade Level 10 Effect
  lvl15Effect?: string; // Upgrade Level 15 Effect
  imageBase64?: string;
  createdAt?: number;
}

export interface BossData {
  id?: string;
  name: string;
  type: "MVP" | "Mini";
  level: number;
  element: string;
  race: string;
  size: "Small" | "Medium" | "Large" | string;
  spawnTime: string; // e.g., "60 minutes" or "120 minutes"
  location: string;
  drops: string[];
  imageBase64?: string;
  createdAt?: number;
}
