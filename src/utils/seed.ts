import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Skill, Patch, MapData, CardData, BossData } from "../types";
import { handleFirestoreError, OperationType } from "./firestoreError";

// Base64 Placeholder SVGs to serve as initial imagery
const skillIconBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f59e0b'/><circle cx='50' cy='50' r='30' fill='%23ffffff' opacity='0.3'/><path d='M35,65 L50,30 L65,65 Z' fill='%23ffffff'/></svg>";
const cardIconBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='150' viewBox='0 0 100 150'><rect width='100' height='150' rx='10' fill='%233b82f6'/><rect x='10' y='10' width='80' height='80' rx='5' fill='%231e3a8a'/><circle cx='50' cy='120' r='12' fill='%23ffffff' opacity='0.5'/></svg>";
const mapIconBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'><rect width='120' height='80' fill='%2310b981'/><circle cx='40' cy='35' r='15' fill='%23ffffff' opacity='0.3'/><circle cx='80' cy='45' r='20' fill='%23ffffff' opacity='0.3'/></svg>";
const bossIconBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ef4444'/><circle cx='50' cy='50' r='35' fill='%237f1d1d'/><circle cx='50' cy='50' r='15' fill='%23ffffff'/></svg>";
const patchIconBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='80' viewBox='0 0 150 80'><rect width='150' height='80' fill='%238b5cf6'/><rect x='15' y='15' width='120' height='10' fill='%23ffffff' opacity='0.8'/><rect x='15' y='35' width='100' height='10' fill='%23ffffff' opacity='0.8'/><rect x='15' y='55' width='70' height='10' fill='%23ffffff' opacity='0.8'/></svg>";

const initialSkills: Skill[] = [
  {
    name: "Bash",
    type: "PDMG",
    percentage: "250%",
    cooldown: "0.5s",
    castTime: "Instant",
    spCost: "15 SP",
    description: "Memberikan physical damage kuat sebesar 250% kepada satu target dan memiliki peluang sebesar 25% untuk memberikan efek Stun selama 2 detik.",
    job: "Swordsman",
    imageBase64: skillIconBase64,
    createdAt: Date.now()
  },
  {
    name: "Bowling Bash",
    type: "PDMG",
    percentage: "500%",
    cooldown: "2.0s",
    castTime: "Instant",
    spCost: "32 SP",
    description: "Menyerang barisan musuh, memukul mundur mereka, dan menyebabkan damage ganda sebesar 500% yang merambat ke musuh di sekitarnya.",
    job: "Knight",
    imageBase64: skillIconBase64,
    createdAt: Date.now() + 10
  },
  {
    name: "Cold Bolt",
    type: "MDMG",
    percentage: "600%",
    cooldown: "1.2s",
    castTime: "2.5s",
    spCost: "45 SP",
    description: "Memanggil bongkahan es dari langit untuk menjatuhi musuh secara bertubi-tubi, memberikan magic damage elemen Air sebesar 600%.",
    job: "Mage",
    imageBase64: skillIconBase64,
    createdAt: Date.now() + 20
  },
  {
    name: "Heal",
    type: "Support",
    percentage: "120%",
    cooldown: "1.0s",
    castTime: "Instant",
    spCost: "20 SP",
    description: "Memulihkan HP diri sendiri atau rekan satu tim dengan daya pemulihan berbasis statistik MATK karakter.",
    job: "Acolyte",
    imageBase64: skillIconBase64,
    createdAt: Date.now() + 30
  },
  {
    name: "Final Rhapsody",
    type: "PDMG",
    percentage: "1500%",
    cooldown: "5.0s",
    castTime: "Instant",
    spCost: "24 SP",
    description: "Deals 1500% PDMG to nearby enemies. Can only be used when [Fantasy Music] stacks reach 5. Using [Final Rhapsody] grants the highest level of [Fantasy Chord]. Global CD: 2.0s.",
    job: "Bard / Dancer",
    imageBase64: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eab308'/><path d='M30,40 C30,30 45,25 55,25 L55,60 C55,70 40,75 35,70 C30,65 30,55 40,55 C45,55 50,58 50,60 L50,35 C45,35 35,38 30,40 Z' fill='%23ffffff'/><circle cx='65' cy='30' r='8' fill='%23ffffff'/></svg>",
    createdAt: Date.now() + 40
  }
];

const initialCards: CardData[] = [
  {
    name: "Poring Card",
    slot: "Armor",
    effect: "MaxHP +100, LUK +2. Memberikan tambahan stat dasar untuk bertahan hidup bagi pemain pemula.",
    stats: "MaxHP +100, LUK +2",
    sourceMonster: "Poring",
    lvl5Effect: "MaxHP +200, LUK +3",
    lvl10Effect: "MaxHP +400, LUK +5, DEF +2",
    lvl15Effect: "MaxHP +800, LUK +8, DEF +6, Physical Res +2%",
    imageBase64: cardIconBase64,
    createdAt: Date.now()
  },
  {
    name: "Marina Card",
    slot: "Weapon",
    effect: "ATK +15. Peluang 5% untuk membekukan (Freeze) target saat melakukan serangan fisik biasa.",
    stats: "ATK +15, 5% Freeze Chance",
    sourceMonster: "Marina",
    lvl5Effect: "ATK +25, Freeze Chance 6%",
    lvl10Effect: "ATK +45, Freeze Chance 8%, Hit +5",
    lvl15Effect: "ATK +70, Freeze Chance 12%, Hit +15, Water DMG +3%",
    imageBase64: cardIconBase64,
    createdAt: Date.now() + 10
  },
  {
    name: "Golden Thief Bug Card",
    slot: "Accessory",
    effect: "Kebal terhadap semua Magic Damage sebesar 85% tetapi meningkatkan konsumsi SP sebesar 35%.",
    stats: "Magic Immunity 85%, SP Cost +35%",
    sourceMonster: "Golden Thief Bug",
    lvl5Effect: "Magic Immunity 87%, SP Cost +30%",
    lvl10Effect: "Magic Immunity 90%, SP Cost +25%, MDEF +10",
    lvl15Effect: "Magic Immunity 95%, SP Cost +15%, MDEF +30, MaxHP +5%",
    imageBase64: cardIconBase64,
    createdAt: Date.now() + 20
  }
];

const initialMaps: MapData[] = [
  {
    name: "Prontera South Gate",
    minLevel: 1,
    monsterList: ["Poring", "Fabre", "Lunatic", "Chonchon"],
    description: "Gerbang selatan kota Prontera yang indah, menjadi tempat latihan utama bagi para petualang baru (Novice). Penuh padang rumput hijau.",
    imageBase64: mapIconBase64,
    createdAt: Date.now()
  },
  {
    name: "Payon Cave F1",
    minLevel: 15,
    monsterList: ["Zombie", "Spore", "Poporing", "Familiar"],
    description: "Gua berhantu di dekat desa Payon. Berisi monster bertipe undead dan bayangan. Sangat cocok untuk Priest pemula.",
    imageBase64: mapIconBase64,
    createdAt: Date.now() + 10
  }
];

const initialBosses: BossData[] = [
  {
    name: "Baphomet",
    type: "MVP",
    level: 80,
    element: "Shadow",
    race: "Demon",
    size: "Large",
    spawnTime: "120", // 120 minutes spawn timer
    location: "Glast Heim Guild Hall",
    drops: ["Baphomet Card", "Crescent Scythe", "Elunium", "Oridecon"],
    imageBase64: bossIconBase64,
    createdAt: Date.now()
  },
  {
    name: "Golden Thief Bug",
    type: "MVP",
    level: 40,
    element: "Fire",
    race: "Insect",
    size: "Large",
    spawnTime: "60", // 60 minutes
    location: "Prontera Culvert F4",
    drops: ["Golden Thief Bug Card", "Golden Gear", "Iron", "Gold"],
    imageBase64: bossIconBase64,
    createdAt: Date.now() + 10
  },
  {
    name: "Angeling",
    type: "Mini",
    level: 35,
    element: "Holy",
    race: "Angel",
    size: "Medium",
    spawnTime: "45", // 45 minutes
    location: "Prontera South Gate",
    drops: ["Angeling Card", "Halo", "Apple Juice", "Royal Jelly"],
    imageBase64: bossIconBase64,
    createdAt: Date.now() + 20
  }
];

const initialPatches: Patch[] = [
  {
    title: "Ragnarok Origin Classic Launch",
    date: "2026-06-25",
    content: "Selamat datang petualang di Ragnarok Origin Classic (ROOC) Server! Bernostalgia kembali ke dunia Rune-Midgards lama dengan penyeimbangan job klasik, grafik modern, dan sistem komunitas yang seru. Bergabunglah dengan guild, lawan MVP bersama, dan jadilah yang terkuat!",
    tags: ["Launch", "Server", "Classic"],
    author: "ROOC Dev Team",
    imageBase64: patchIconBase64,
    createdAt: Date.now()
  },
  {
    title: "Update Patch v1.1 - Kelas Ksatria Lord Knight Beraksi!",
    date: "2026-06-28",
    content: "Penyeimbangan mekanik baru untuk kelas Lord Knight (LK): Peningkatan damage Spiral Pierce sebesar 20%, durasi Bowling Bash dikurangi 0.2s untuk kelancaran kombo, serta penambahan durasi buff Frenzy. Rasakan kekuatan tempur terdepan!",
    tags: ["Balance", "Job", "Lord Knight"],
    author: "ROOC Community Admin",
    imageBase64: patchIconBase64,
    createdAt: Date.now() + 10
  }
];

/**
 * Seeds Firestore collections if they are completely empty
 */
export async function seedDatabaseIfEmpty() {
  try {
    // 1. Seed Skills
    const skillsCol = collection(db, "skills");
    let skillsSnap;
    try {
      skillsSnap = await getDocs(skillsCol);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "skills");
      return;
    }

    if (skillsSnap && skillsSnap.empty) {
      console.log("Seeding initial skills...");
      for (const item of initialSkills) {
        try {
          await addDoc(skillsCol, item);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "skills");
        }
      }
    }

    // 2. Seed Cards
    const cardsCol = collection(db, "cards");
    let cardsSnap;
    try {
      cardsSnap = await getDocs(cardsCol);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "cards");
      return;
    }

    if (cardsSnap && cardsSnap.empty) {
      console.log("Seeding initial cards...");
      for (const item of initialCards) {
        try {
          await addDoc(cardsCol, item);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "cards");
        }
      }
    }

    // 3. Seed Maps
    const mapsCol = collection(db, "maps");
    let mapsSnap;
    try {
      mapsSnap = await getDocs(mapsCol);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "maps");
      return;
    }

    if (mapsSnap && mapsSnap.empty) {
      console.log("Seeding initial maps...");
      for (const item of initialMaps) {
        try {
          await addDoc(mapsCol, item);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "maps");
        }
      }
    }

    // 4. Seed Bosses (MVPs & Minis)
    const mvpCol = collection(db, "mvps");
    let mvpSnap;
    try {
      mvpSnap = await getDocs(mvpCol);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "mvps");
      return;
    }

    if (mvpSnap && mvpSnap.empty) {
      console.log("Seeding initial MVPs/Minis...");
      for (const item of initialBosses) {
        try {
          await addDoc(mvpCol, item);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "mvps");
        }
      }
    }

    // 5. Seed Patches
    const patchCol = collection(db, "new_patches");
    let patchSnap;
    try {
      patchSnap = await getDocs(patchCol);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "new_patches");
      return;
    }

    if (patchSnap && patchSnap.empty) {
      console.log("Seeding initial patch notes...");
      for (const item of initialPatches) {
        try {
          await addDoc(patchCol, item);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "new_patches");
        }
      }
    }

    console.log("ROOC database seeding process finished successfully.");
  } catch (error) {
    console.error("Error during seeding database:", error);
  }
}
