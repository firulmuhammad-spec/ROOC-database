/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from "firebase/firestore";
import { db } from "./firebase";
import { seedDatabaseIfEmpty } from "./utils/seed";
import { handleFirestoreError, OperationType } from "./utils/firestoreError";
import { runAIScan } from "./utils/ai";
import { fileToBase64 } from "./utils/base64";
import { Skill, Patch, MapData, CardData, BossData } from "./types";
import { 
  Swords, BookOpen, MapPin, CreditCard, Skull, Calculator, 
  Lock, Unlock, LogOut, Plus, Edit2, Trash2, Search, Filter, 
  Sparkles, Upload, RefreshCw, Clock, ShieldAlert, X, AlertTriangle, 
  User, Eye, HelpCircle, Flame, CheckCircle, Sliders, Play
} from "lucide-react";

const ELEMENTS = ["None", "Wind", "Earth", "Fire", "Water", "Poison", "Holy", "Shadow", "Ghost", "Undead"];

const ELEMENT_COLORS: Record<string, string> = {
  None: "bg-neutral-800 text-neutral-300 border-neutral-700",
  Wind: "bg-cyan-950/40 text-cyan-400 border-cyan-900/30",
  Earth: "bg-amber-950/40 text-amber-500 border-amber-900/30",
  Fire: "bg-red-950/40 text-red-400 border-red-900/30",
  Water: "bg-blue-950/40 text-blue-400 border-blue-900/30",
  Poison: "bg-purple-950/40 text-purple-400 border-purple-900/30",
  Holy: "bg-yellow-950/40 text-yellow-300 border-yellow-900/30",
  Shadow: "bg-slate-950/60 text-slate-400 border-slate-900/30",
  Ghost: "bg-indigo-950/40 text-indigo-400 border-indigo-900/30",
  Undead: "bg-rose-950/40 text-rose-400 border-rose-900/30"
};

const ELEMENT_MATRIX: Record<string, Record<string, string>> = {
  None: {
    None: "100%", Wind: "100%", Earth: "100%", Fire: "100%", Water: "100%", Poison: "100%", Holy: "100%", Shadow: "100%", Ghost: "30%", Undead: "100%"
  },
  Wind: {
    None: "100%", Wind: "25%", Earth: "50%", Fire: "100%", Water: "175%", Poison: "100%", Holy: "75%", Shadow: "100%", Ghost: "100%", Undead: "100%"
  },
  Earth: {
    None: "100%", Wind: "175%", Earth: "25%", Fire: "50%", Water: "100%", Poison: "100%", Holy: "75%", Shadow: "100%", Ghost: "100%", Undead: "100%"
  },
  Fire: {
    None: "100%", Wind: "100%", Earth: "175%", Fire: "25%", Water: "50%", Poison: "100%", Holy: "75%", Shadow: "100%", Ghost: "100%", Undead: "150%"
  },
  Water: {
    None: "100%", Wind: "50%", Earth: "100%", Fire: "175%", Water: "25%", Poison: "100%", Holy: "75%", Shadow: "100%", Ghost: "100%", Undead: "100%"
  },
  Poison: {
    None: "100%", Wind: "125%", Earth: "125%", Fire: "125%", Water: "125%", Poison: "25%", Holy: "50%", Shadow: "50%", Ghost: "100%", Undead: "25%"
  },
  Holy: {
    None: "100%", Wind: "100%", Earth: "100%", Fire: "100%", Water: "100%", Poison: "100%", Holy: "25%", Shadow: "175%", Ghost: "100%", Undead: "175%"
  },
  Shadow: {
    None: "100%", Wind: "100%", Earth: "100%", Fire: "100%", Water: "100%", Poison: "50%", Holy: "175%", Shadow: "25%", Ghost: "100%", Undead: "25%"
  },
  Ghost: {
    None: "30%", Wind: "100%", Earth: "100%", Fire: "100%", Water: "100%", Poison: "100%", Holy: "75%", Shadow: "75%", Ghost: "175%", Undead: "125%"
  },
  Undead: {
    None: "100%", Wind: "100%", Earth: "100%", Fire: "100%", Water: "100%", Poison: "50%", Holy: "125%", Shadow: "25%", Ghost: "100%", Undead: "25%"
  }
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"skills" | "patch" | "maps" | "cards" | "mvp" | "calc" | "elements">("skills");
  
  // Admin State
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem("rooc_admin") === "true";
  });
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("All");

  // Element Matchup Tester States
  const [selectedAtkElement, setSelectedAtkElement] = useState<string>("Fire");
  const [selectedDefElement, setSelectedDefElement] = useState<string>("Earth");

  // Live Firestore Databases
  const [skills, setSkills] = useState<Skill[]>([]);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [mvps, setMvps] = useState<BossData[]>([]);

  // Modals & CRUD Form States
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [formType, setFormType] = useState<"skills" | "patch" | "maps" | "cards" | "mvp" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Inputs - Skill
  const [skillName, setSkillName] = useState("");
  const [skillType, setSkillType] = useState<"PDMG" | "MDMG" | "Support" | "Passive">("PDMG");
  const [skillPercentage, setSkillPercentage] = useState("");
  const [skillCooldown, setSkillCooldown] = useState("");
  const [skillCastTime, setSkillCastTime] = useState("");
  const [skillSpCost, setSkillSpCost] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillJob, setSkillJob] = useState("Swordsman");
  const [skillImage, setSkillImage] = useState("");
  const [jobFilter, setJobFilter] = useState("All");

  // Inline calculator state for skill damage calculations
  const [skillAtkInput, setSkillAtkInput] = useState<Record<string, number>>({});

  // Form Inputs - Patch
  const [patchTitle, setPatchTitle] = useState("");
  const [patchDate, setPatchDate] = useState("");
  const [patchContent, setPatchContent] = useState("");
  const [patchTags, setPatchTags] = useState("");
  const [patchAuthor, setPatchAuthor] = useState("");
  const [patchImage, setPatchImage] = useState("");

  // Form Inputs - Map
  const [mapName, setMapName] = useState("");
  const [mapMinLevel, setMapMinLevel] = useState<number>(1);
  const [mapMonsters, setMapMonsters] = useState("");
  const [mapDescription, setMapDescription] = useState("");
  const [mapImage, setMapImage] = useState("");

  // Form Inputs - Card
  const [cardName, setCardName] = useState("");
  const [cardSlot, setCardSlot] = useState("Weapon");
  const [cardEffect, setCardEffect] = useState("");
  const [cardStats, setCardStats] = useState("");
  const [cardSourceMonster, setCardSourceMonster] = useState("");
  const [cardLvl5Effect, setCardLvl5Effect] = useState("");
  const [cardLvl10Effect, setCardLvl10Effect] = useState("");
  const [cardLvl15Effect, setCardLvl15Effect] = useState("");
  const [cardImage, setCardImage] = useState("");

  // Form Inputs - MVP / Mini Boss
  const [bossName, setBossName] = useState("");
  const [bossType, setBossType] = useState<"MVP" | "Mini">("MVP");
  const [bossLevel, setBossLevel] = useState<number>(50);
  const [bossElement, setBossElement] = useState("Neutral");
  const [bossRace, setBossRace] = useState("Demi-Human");
  const [bossSize, setBossSize] = useState("Medium");
  const [bossSpawnTime, setBossSpawnTime] = useState("60");
  const [bossLocation, setBossLocation] = useState("");
  const [bossDrops, setBossDrops] = useState("");
  const [bossImage, setBossImage] = useState("");

  // AI Scanner States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [scannedImagePreview, setScannedImagePreview] = useState<string | null>(null);

  // Time ticker state for boss timers
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Damage Calculator Inputs
  const [calcJob, setCalcJob] = useState<"Lord Knight" | "Assassin Cross" | "High Wizard" | "Sniper" | "High Priest" | "Whitesmith">("Lord Knight");
  const [calcBaseAtk, setCalcBaseAtk] = useState<number>(1200);
  const [calcSkillMult, setCalcSkillMult] = useState<number>(250);
  const [calcCardBoost, setCalcCardBoost] = useState<number>(20);
  const [calcEnemySize, setCalcEnemySize] = useState<number>(1.0); // Size modifier
  const [calcEnemyElement, setCalcEnemyElement] = useState<number>(1.5); // Elemental multiplier
  const [calcEnemyRace, setCalcEnemyRace] = useState<number>(1.1); // Race modifier
  const [calcEnemyDef, setCalcEnemyDef] = useState<number>(150); // Defense reduction divisor-helper
  const [calcFlatBonus, setCalcFlatBonus] = useState<number>(100);
  const [calculatedDamage, setCalculatedDamage] = useState<number>(0);

  // Bootstrapping and Firestore Synchronization
  useEffect(() => {
    // Seed database with beautiful defaults if completely empty
    seedDatabaseIfEmpty();

    // Live sync for Skills
    const qSkills = query(collection(db, "skills"), orderBy("createdAt", "desc"));
    const unsubSkills = onSnapshot(qSkills, (snap) => {
      const list: Skill[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Skill);
      });
      setSkills(list);
    }, (error) => {
      console.error("Skills sync error:", error);
      handleFirestoreError(error, OperationType.LIST, "skills");
    });

    // Live sync for Patches
    const qPatches = query(collection(db, "new_patches"), orderBy("createdAt", "desc"));
    const unsubPatches = onSnapshot(qPatches, (snap) => {
      const list: Patch[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Patch);
      });
      setPatches(list);
    }, (error) => {
      console.error("Patches sync error:", error);
      handleFirestoreError(error, OperationType.LIST, "new_patches");
    });

    // Live sync for Maps
    const qMaps = query(collection(db, "maps"), orderBy("createdAt", "desc"));
    const unsubMaps = onSnapshot(qMaps, (snap) => {
      const list: MapData[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MapData);
      });
      setMaps(list);
    }, (error) => {
      console.error("Maps sync error:", error);
      handleFirestoreError(error, OperationType.LIST, "maps");
    });

    // Live sync for Cards
    const qCards = query(collection(db, "cards"), orderBy("createdAt", "desc"));
    const unsubCards = onSnapshot(qCards, (snap) => {
      const list: CardData[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as CardData);
      });
      setCards(list);
    }, (error) => {
      console.error("Cards sync error:", error);
      handleFirestoreError(error, OperationType.LIST, "cards");
    });

    // Live sync for MVPs
    const qMvps = query(collection(db, "mvps"), orderBy("createdAt", "desc"));
    const unsubMvps = onSnapshot(qMvps, (snap) => {
      const list: BossData[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as BossData);
      });
      setMvps(list);
    }, (error) => {
      console.error("MVPs sync error:", error);
      handleFirestoreError(error, OperationType.LIST, "mvps");
    });

    // Real-time ticking clock for boss spawns
    const timerId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsubSkills();
      unsubPatches();
      unsubMaps();
      unsubCards();
      unsubMvps();
      clearInterval(timerId);
    };
  }, []);

  // Recalculate damage output whenever parameters shift
  useEffect(() => {
    // Formula simulation: 
    // Damage = ((BaseATK * (SkillMult / 100)) * (1 + CardBoost / 100) * SizeMod * ElementMod * RaceMod) * (1 - (DEF / (DEF + 600))) + FlatBonus
    const rawMultiplier = calcSkillMult / 100;
    const baseSkillDamage = calcBaseAtk * rawMultiplier;
    const itemDamage = baseSkillDamage * (1 + calcCardBoost / 100);
    const modifiedDamage = itemDamage * calcEnemySize * calcEnemyElement * calcEnemyRace;
    const defenseReduction = calcEnemyDef / (calcEnemyDef + 600); // standard RO defense scaling curve
    const finalCalculated = Math.round(modifiedDamage * (1 - defenseReduction) + calcFlatBonus);
    setCalculatedDamage(finalCalculated < 1 ? 1 : finalCalculated);
  }, [
    calcJob, calcBaseAtk, calcSkillMult, calcCardBoost, 
    calcEnemySize, calcEnemyElement, calcEnemyRace, calcEnemyDef, calcFlatBonus
  ]);

  // Handle Admin Auth Submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput === "adm" && passwordInput === "123") {
      setIsAdmin(true);
      localStorage.setItem("rooc_admin", "true");
      setShowLoginModal(false);
      setLoginError("");
      setUsernameInput("");
      setPasswordInput("");
    } else {
      setLoginError("Kombinasi Username / Password salah!");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem("rooc_admin");
  };

  // Convert uploaded image file to Base64 and assign to form
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setField: (b64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setField(base64);
      } catch (err) {
        console.error("Base64 reading failed:", err);
        alert("Gagal memuat gambar. Silakan coba file lain.");
      }
    }
  };

  // Automated AI Screenshot OCR Scanner
  const triggerAIScan = async (type: "skill" | "card") => {
    if (!scannedImagePreview) {
      alert("Silakan unggah screenshot game terlebih dahulu untuk discan!");
      return;
    }

    setIsScanning(true);
    setScanStatus("Menyiapkan pemindaian AI...");

    try {
      const result = await runAIScan(scannedImagePreview, type, (statusText) => {
        setScanStatus(statusText);
      });

      if (result.success && result.data) {
        const payload = result.data;
        if (type === "skill") {
          if (payload.name) setSkillName(payload.name);
          if (payload.type) setSkillType(payload.type);
          if (payload.percentage) setSkillPercentage(payload.percentage);
          if (payload.cooldown) setSkillCooldown(payload.cooldown);
          if (payload.castTime) setSkillCastTime(payload.castTime);
          if (payload.spCost) setSkillSpCost(payload.spCost);
          if (payload.description) setSkillDescription(payload.description);
          setSkillImage(scannedImagePreview); // Auto assign scanned screenshot to the image field
        } else {
          if (payload.name) setCardName(payload.name);
          if (payload.slot) setCardSlot(payload.slot);
          if (payload.effect) setCardEffect(payload.effect);
          if (payload.stats) setCardStats(payload.stats);
          if (payload.sourceMonster) setCardSourceMonster(payload.sourceMonster);
          setCardImage(scannedImagePreview); // Auto assign scanned screenshot to the image field
        }
        alert("Scan Berhasil! Data telah diisikan ke formulir.");
      } else {
        alert(result.error || "Gagal mengekstrak data dari screenshot. Silakan isi manual.");
      }
    } catch (err: any) {
      console.error("Scanning process failed:", err);
      alert("Terjadi kesalahan sistem saat pemindaian: " + err.message);
    } finally {
      setIsScanning(false);
      setScannedImagePreview(null);
    }
  };

  // CRUD Operations: Show and prep forms
  const openAddForm = (type: "skills" | "patch" | "maps" | "cards" | "mvp") => {
    setFormType(type);
    setEditingId(null);
    setScannedImagePreview(null);
    
    // Clear all states
    setSkillName(""); setSkillType("PDMG"); setSkillPercentage(""); setSkillCooldown(""); setSkillCastTime(""); setSkillSpCost(""); setSkillDescription(""); setSkillJob("Swordsman"); setSkillImage("");
    setPatchTitle(""); setPatchDate(new Date().toISOString().split('T')[0]); setPatchContent(""); setPatchTags(""); setPatchAuthor("ROOC Admin"); setPatchImage("");
    setMapName(""); setMapMinLevel(1); setMapMonsters(""); setMapDescription(""); setMapImage("");
    setCardName(""); setCardSlot("Weapon"); setCardEffect(""); setCardStats(""); setCardSourceMonster(""); setCardLvl5Effect(""); setCardLvl10Effect(""); setCardLvl15Effect(""); setCardImage("");
    setBossName(""); setBossType("MVP"); setBossLevel(50); setBossElement("Neutral"); setBossRace("Demi-Human"); setBossSize("Medium"); setBossSpawnTime("60"); setBossLocation(""); setBossDrops(""); setBossImage("");

    setShowFormModal(true);
  };

  const openEditForm = (type: "skills" | "patch" | "maps" | "cards" | "mvp", item: any) => {
    setFormType(type);
    setEditingId(item.id);
    setScannedImagePreview(null);
    setShowFormModal(true);

    if (type === "skills") {
      const sk = item as Skill;
      setSkillName(sk.name);
      setSkillType(sk.type);
      setSkillPercentage(sk.percentage);
      setSkillCooldown(sk.cooldown);
      setSkillCastTime(sk.castTime);
      setSkillSpCost(sk.spCost);
      setSkillDescription(sk.description);
      setSkillJob(sk.job || "Swordsman");
      setSkillImage(sk.imageBase64 || "");
    } else if (type === "patch") {
      const pt = item as Patch;
      setPatchTitle(pt.title);
      setPatchDate(pt.date);
      setPatchContent(pt.content);
      setPatchTags(pt.tags.join(", "));
      setPatchAuthor(pt.author);
      setPatchImage(pt.imageBase64 || "");
    } else if (type === "maps") {
      const mp = item as MapData;
      setMapName(mp.name);
      setMapMinLevel(mp.minLevel);
      setMapMonsters(mp.monsterList.join(", "));
      setMapDescription(mp.description);
      setMapImage(mp.imageBase64 || "");
    } else if (type === "cards") {
      const cd = item as CardData;
      setCardName(cd.name);
      setCardSlot(cd.slot);
      setCardEffect(cd.effect);
      setCardStats(cd.stats);
      setCardSourceMonster(cd.sourceMonster);
      setCardLvl5Effect(cd.lvl5Effect || "");
      setCardLvl10Effect(cd.lvl10Effect || "");
      setCardLvl15Effect(cd.lvl15Effect || "");
      setCardImage(cd.imageBase64 || "");
    } else if (type === "mvp") {
      const mv = item as BossData;
      setBossName(mv.name);
      setBossType(mv.type);
      setBossLevel(mv.level);
      setBossElement(mv.element);
      setBossRace(mv.race);
      setBossSize(mv.size);
      setBossSpawnTime(mv.spawnTime);
      setBossLocation(mv.location);
      setBossDrops(mv.drops.join(", "));
      setBossImage(mv.imageBase64 || "");
    }
  };

  const handleDeleteItem = async (collectionName: string, id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data ini dari database?")) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, collectionName);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formType === "skills") {
        const payload: Skill = {
          name: skillName,
          type: skillType,
          percentage: skillPercentage || "100%",
          cooldown: skillCooldown || "None",
          castTime: skillCastTime || "Instant",
          spCost: skillSpCost || "0 SP",
          description: skillDescription,
          job: skillJob || "Swordsman",
          imageBase64: skillImage || undefined,
          createdAt: Date.now()
        };

        if (editingId) {
          try {
            await updateDoc(doc(db, "skills", editingId), { ...payload });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "skills");
          }
        } else {
          try {
            await addDoc(collection(db, "skills"), payload);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, "skills");
          }
        }
      } 
      else if (formType === "patch") {
        const payload: Patch = {
          title: patchTitle,
          date: patchDate,
          content: patchContent,
          tags: patchTags.split(",").map(t => t.trim()).filter(Boolean),
          author: patchAuthor,
          imageBase64: patchImage || undefined,
          createdAt: Date.now()
        };

        if (editingId) {
          try {
            await updateDoc(doc(db, "new_patches", editingId), { ...payload });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "new_patches");
          }
        } else {
          try {
            await addDoc(collection(db, "new_patches"), payload);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, "new_patches");
          }
        }
      }
      else if (formType === "maps") {
        const payload: MapData = {
          name: mapName,
          minLevel: Number(mapMinLevel),
          monsterList: mapMonsters.split(",").map(m => m.trim()).filter(Boolean),
          description: mapDescription,
          imageBase64: mapImage || undefined,
          createdAt: Date.now()
        };

        if (editingId) {
          try {
            await updateDoc(doc(db, "maps", editingId), { ...payload });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "maps");
          }
        } else {
          try {
            await addDoc(collection(db, "maps"), payload);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, "maps");
          }
        }
      }
      else if (formType === "cards") {
        const payload: CardData = {
          name: cardName,
          slot: cardSlot,
          effect: cardEffect,
          stats: cardStats,
          sourceMonster: cardSourceMonster,
          lvl5Effect: cardLvl5Effect || undefined,
          lvl10Effect: cardLvl10Effect || undefined,
          lvl15Effect: cardLvl15Effect || undefined,
          imageBase64: cardImage || undefined,
          createdAt: Date.now()
        };

        if (editingId) {
          try {
            await updateDoc(doc(db, "cards", editingId), { ...payload });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "cards");
          }
        } else {
          try {
            await addDoc(collection(db, "cards"), payload);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, "cards");
          }
        }
      }
      else if (formType === "mvp") {
        const payload: BossData = {
          name: bossName,
          type: bossType,
          level: Number(bossLevel),
          element: bossElement,
          race: bossRace,
          size: bossSize,
          spawnTime: bossSpawnTime,
          location: bossLocation,
          drops: bossDrops.split(",").map(d => d.trim()).filter(Boolean),
          imageBase64: bossImage || undefined,
          createdAt: Date.now()
        };

        if (editingId) {
          try {
            await updateDoc(doc(db, "mvps", editingId), { ...payload });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "mvps");
          }
        } else {
          try {
            await addDoc(collection(db, "mvps"), payload);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, "mvps");
          }
        }
      }

      setShowFormModal(false);
      setEditingId(null);
    } catch (err: any) {
      console.error("Form submit error:", err);
      alert("Gagal menyimpan data: " + err.message);
    }
  };

  // MVP Collaborative Death Recorder
  const recordBossDeath = async (bossId: string) => {
    try {
      await updateDoc(doc(db, "mvps", bossId), {
        lastKilledAt: Date.now()
      });
    } catch (err: any) {
      console.error("Failed to record death:", err);
      handleFirestoreError(err, OperationType.UPDATE, "mvps");
    }
  };

  // Helper to format remaining spawn time
  const getSpawnStatusText = (boss: BossData & { lastKilledAt?: number }) => {
    if (!boss.lastKilledAt) {
      return { text: "ALIVE / READY", class: "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse font-bold" };
    }

    const intervalMinutes = Number(boss.spawnTime) || 60;
    const nextSpawnTime = boss.lastKilledAt + intervalMinutes * 60 * 1000;
    const timeLeftMs = nextSpawnTime - currentTime;

    if (timeLeftMs <= 0) {
      return { text: "ALIVE / READY", class: "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse font-bold" };
    }

    const totalSeconds = Math.floor(timeLeftMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedTime = `${hours > 0 ? hours + "h " : ""}${minutes}m ${seconds}s`;
    return { text: `Spawning in ${formattedTime}`, class: "bg-amber-100 text-amber-800 border-amber-300" };
  };

  // Filter lists based on query & selected type filter
  const filteredSkills = skills.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = typeFilter === "All" || item.type === typeFilter;
    const matchesJob = jobFilter === "All" || item.job === jobFilter;
    return matchesSearch && matchesFilter && matchesJob;
  });

  const filteredPatches = patches.filter(item => {
    return item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           item.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredMaps = maps.filter(item => {
    return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           item.monsterList.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const filteredCards = cards.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.effect.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.sourceMonster.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = typeFilter === "All" || item.slot === typeFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredMvps = mvps.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.element.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = typeFilter === "All" || item.type === typeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F0F0E8] font-sans flex flex-col antialiased selection:bg-[#C19A6B] selection:text-[#0F0F0F]">
      
      {/* Dynamic Admin Notification Strip */}
      {isAdmin && (
        <div className="bg-[#C19A6B] text-[#0F0F0F] text-xs py-2 px-6 flex items-center justify-between font-bold border-b border-[#2A2A2A] tracking-wider uppercase">
          <div className="flex items-center gap-2">
            <Unlock className="w-3.5 h-3.5" />
            <span>Admin Mode Active — Full database CRUD authorization and Gemini OCR scanning granted.</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-[#0F0F0F] text-[#C19A6B] hover:bg-[#C19A6B] hover:text-[#0F0F0F] transition duration-200 py-1 px-3 border border-[#0F0F0F] font-bold uppercase text-[10px]"
          >
            <LogOut className="w-3 h-3" />
            Exit Admin
          </button>
        </div>
      )}

      {/* Main Elegant Header */}
      <header className="bg-[#0F0F0F] border-b border-[#2A2A2A] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex flex-col cursor-pointer justify-center" onClick={() => setActiveTab("skills")}>
              <h1 className="text-2xl font-serif italic font-bold tracking-tighter text-[#C19A6B] flex items-center gap-1.5">
                ROOC
              </h1>
              <p className="text-[9px] text-[#F0F0E8] opacity-50 font-mono tracking-[0.25em] uppercase">Origin Classic Archive</p>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1 h-full items-center">
              {[
                { id: "skills", label: "Skills", count: "01" },
                { id: "patch", label: "New Patch", count: "02" },
                { id: "maps", label: "Maps", count: "03" },
                { id: "cards", label: "Card Effects", count: "04" },
                { id: "mvp", label: "MVP & Mini", count: "05" },
                { id: "calc", label: "Calculator", count: "06" },
                { id: "elements", label: "Element Chart", count: "07" },
              ].map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-btn-${tab.id}`}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setSearchQuery("");
                      setTypeFilter("All");
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm transition-all duration-200 border-b-2 ${
                      isSelected 
                        ? "text-[#C19A6B] font-serif italic border-[#C19A6B]" 
                        : "text-[#F0F0E8] opacity-40 hover:opacity-100 border-transparent hover:text-[#C19A6B]"
                    }`}
                  >
                    <span className="text-[10px] font-mono opacity-60">{tab.count}</span>
                    <span className="text-sm font-serif italic">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Action: Admin Login Lock */}
            <div className="flex items-center gap-2">
              {!isAdmin ? (
                <button
                  id="btn-admin-login"
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 text-[11px] text-[#C19A6B] hover:text-[#0F0F0F] bg-transparent hover:bg-[#C19A6B] transition duration-200 py-2 px-4 border border-[#2A2A2A] font-bold uppercase tracking-widest cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>Admin Portal</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="hidden lg:inline text-[10px] text-[#C19A6B] uppercase tracking-wider font-mono">ADM ACTIVE // SECURE</span>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Tab Rail */}
      <div className="md:hidden bg-[#121212] border-b border-[#2A2A2A] flex overflow-x-auto whitespace-nowrap p-2 scrollbar-none sticky top-20 z-25">
        {[
          { id: "skills", label: "Skills", count: "01" },
          { id: "patch", label: "Patch", count: "02" },
          { id: "maps", label: "Maps", count: "03" },
          { id: "cards", label: "Cards", count: "04" },
          { id: "mvp", label: "Bosses", count: "05" },
          { id: "calc", label: "Damage", count: "06" },
          { id: "elements", label: "Elements", count: "07" },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearchQuery("");
                setTypeFilter("All");
              }}
              className={`flex items-center gap-1.5 px-3 py-2 mr-1 transition-all ${
                isSelected 
                  ? "bg-[#C19A6B] text-[#0F0F0F] font-serif italic font-bold" 
                  : "text-[#F0F0E8] opacity-50 hover:opacity-100"
              }`}
            >
              <span className="text-[9px] font-mono opacity-50">{tab.count}</span>
              <span className="text-xs font-serif italic">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Top Hero/Welcome Banner */}
      <section className="bg-[#1A1A1A] border-b border-[#2A2A2A] text-[#F0F0E8] py-12 px-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2.5">
              <span className="bg-[#C19A6B]/10 text-[#C19A6B] text-[10px] uppercase font-mono tracking-widest font-bold px-2.5 py-1 border border-[#C19A6B]/20">
                Official ROOC Sandbox v1.2
              </span>
              <div className="h-3 w-[1px] bg-[#2A2A2A]"></div>
              <span className="text-[#F0F0E8] opacity-50 text-[10px] uppercase tracking-widest font-mono">Community Classic Archive</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif italic font-bold tracking-tight text-[#C19A6B]">
              {activeTab === "skills" && "Pustaka Klasik Skill Karakter"}
              {activeTab === "patch" && "Berita Patch Terbaru & Changelog"}
              {activeTab === "maps" && "Atlas Peta Rune-Midgards"}
              {activeTab === "cards" && "Katalog Efek Kartu Monster"}
              {activeTab === "mvp" && "MVP & Mini Boss Real-Time Spawns"}
              {activeTab === "calc" && "Kalkulator Simulasi Damage Klasik"}
            </h2>
            <p className="text-[#F0F0E8]/70 text-xs sm:text-sm mt-3 max-w-3xl leading-relaxed">
              {activeTab === "skills" && "Pelajari rasio peningkatan physical damage (PDMG) dan magical damage (MDMG) lengkap dengan status cooldown serta deskripsi skill."}
              {activeTab === "patch" && "Pantau terus rilis konten game terbaru, penyeimbangan kelas pahlawan, perbaikan bug, dan pengumuman komunitas."}
              {activeTab === "maps" && "Temukan zona leveling yang optimal untuk karakter Anda berdasarkan tingkat level minimum monster di setiap lokasi."}
              {activeTab === "cards" && "Konfigurasi kartu terbaik untuk disematkan pada Senjata, Perisai, Baju Zirah, Sepatu, Aksesoris, dan Topi pahlawan Anda."}
              {activeTab === "mvp" && "Gunakan portal timer kolaboratif untuk memantau sisa waktu spawn monster legendaris bersama guild Anda secara live."}
              {activeTab === "calc" && "Eksperimen kombo stat, multiplier skill, bonus kartu, dan efektivitas elemen untuk menghasilkan damage maksimal!"}
            </p>
          </div>

          {/* Admin Fast-Action Prompt */}
          {isAdmin && (
            <button
              onClick={() => openAddForm(activeTab as any)}
              className="flex items-center gap-2 bg-[#C19A6B] hover:bg-[#A98458] text-[#0F0F0F] font-bold py-3.5 px-6 text-xs uppercase tracking-widest transition-all shrink-0 duration-250"
            >
              <Plus className="w-4 h-4" />
              <span>Add {activeTab.toUpperCase()} Record</span>
            </button>
          )}
        </div>
      </section>


      {/* Main Layout Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Controls Toolbar (Except for Damage Calc) */}
        {activeTab !== "calc" && (
          <div className="bg-[#1A1A1A] p-5 border border-[#2A2A2A] mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C19A6B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari nama ${activeTab === "skills" ? "skill" : activeTab === "cards" ? "kartu" : activeTab === "mvp" ? "boss" : "data"}...`}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none text-sm focus:outline-none focus:border-[#C19A6B] transition font-mono"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
              {activeTab === "skills" && (
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                  <div className="flex gap-1.5 overflow-x-auto">
                    {["All", "PDMG", "MDMG", "Support", "Passive"].map(filterVal => (
                      <button
                        key={filterVal}
                        onClick={() => setTypeFilter(filterVal)}
                        className={`px-4 py-1.5 text-xs font-serif italic font-bold shrink-0 transition ${
                          typeFilter === filterVal 
                            ? "bg-[#C19A6B] text-[#0F0F0F]" 
                            : "bg-[#2A2A2A] text-[#F0F0E8]/70 hover:bg-[#3A3A3A] hover:text-[#F0F0E8]"
                        }`}
                      >
                        {filterVal}
                      </button>
                    ))}
                  </div>
                  <div className="border-l border-[#2A2A2A] h-5 mx-1 hidden md:block" />
                  <select
                    value={jobFilter}
                    onChange={(e) => setJobFilter(e.target.value)}
                    className="bg-[#0F0F0F] text-[#C19A6B] border border-[#2A2A2A] px-3 py-1.5 text-xs font-serif italic font-bold focus:outline-none focus:border-[#C19A6B]"
                  >
                    <option value="All">Semua Job Class</option>
                    {["Swordsman", "Knight", "Mage", "Wizard", "Acolyte", "Priest", "Archer", "Hunter", "Thief", "Assassin", "Merchant", "Blacksmith", "Bard / Dancer", "Novice / General"].map((job) => (
                      <option key={job} value={job}>{job}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === "cards" && (
                <>
                  {["All", "Weapon", "Armor", "Shield", "Garment", "Shoes", "Accessory", "Headwear"].map(filterVal => (
                    <button
                      key={filterVal}
                      onClick={() => setTypeFilter(filterVal)}
                      className={`px-4 py-1.5 text-xs font-serif italic font-bold shrink-0 transition ${
                        typeFilter === filterVal 
                          ? "bg-[#C19A6B] text-[#0F0F0F]" 
                          : "bg-[#2A2A2A] text-[#F0F0E8]/70 hover:bg-[#3A3A3A] hover:text-[#F0F0E8]"
                      }`}
                    >
                      {filterVal}
                    </button>
                  ))}
                </>
              )}

              {activeTab === "mvp" && (
                <>
                  {["All", "MVP", "Mini"].map(filterVal => (
                    <button
                      key={filterVal}
                      onClick={() => setTypeFilter(filterVal)}
                      className={`px-4 py-1.5 text-xs font-serif italic font-bold shrink-0 transition ${
                        typeFilter === filterVal 
                          ? "bg-[#C19A6B] text-[#0F0F0F]" 
                          : "bg-[#2A2A2A] text-[#F0F0E8]/70 hover:bg-[#3A3A3A] hover:text-[#F0F0E8]"
                      }`}
                    >
                      {filterVal}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 1: SKILLS ==================== */}
        {activeTab === "skills" && (
          <div>
            {filteredSkills.length === 0 ? (
              <div className="text-center py-16 bg-[#1A1A1A] border border-[#2A2A2A]">
                <Swords className="w-12 h-12 text-[#C19A6B]/50 mx-auto mb-2" />
                <p className="text-[#F0F0E8]/50 text-sm font-serif italic">Tidak ada skill yang ditemukan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSkills.map((sk) => (
                  <div key={sk.id} className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C19A6B] transition-all duration-300 flex flex-col h-full group p-5 relative">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 border ${
                          sk.type === "PDMG" ? "bg-red-950/40 text-red-400 border-red-900/30" :
                          sk.type === "MDMG" ? "bg-blue-950/40 text-blue-400 border-blue-900/30" :
                          sk.type === "Support" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/30" :
                          "bg-[#2A2A2A] text-[#F0F0E8]/80 border-[#3A3A3A]"
                        }`}>
                          {sk.type}
                        </span>
                        {sk.job && (
                          <span className="text-[10px] bg-[#C19A6B]/15 text-[#C19A6B] px-2 py-0.5 border border-[#C19A6B]/30 uppercase font-mono font-bold tracking-wider">
                            {sk.job}
                          </span>
                        )}
                      </div>
                      
                      {/* Admin controls */}
                      {isAdmin && (
                        <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition duration-150">
                          <button 
                            onClick={() => openEditForm("skills", sk)}
                            className="p-1 text-[#C19A6B] hover:text-[#0F0F0F] hover:bg-[#C19A6B] transition"
                            title="Edit Skill"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem("skills", sk.id!)}
                            className="p-1 text-red-400 hover:text-[#F0F0E8] hover:bg-red-600/60 transition"
                            title="Hapus Skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Title & Icon Layout */}
                    <div className="flex gap-4 items-start">
                      {sk.imageBase64 ? (
                        <img 
                          src={sk.imageBase64} 
                          alt={sk.name} 
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-none object-cover bg-[#0F0F0F] border border-[#2A2A2A] shrink-0 shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-none bg-[#0F0F0F] flex items-center justify-center text-[#C19A6B]/60 shrink-0 border border-[#2A2A2A]">
                          <Swords className="w-7 h-7" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-serif italic font-bold text-[#F0F0E8] group-hover:text-[#C19A6B] text-lg leading-tight truncate transition duration-200">{sk.name}</h3>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 text-[11px] text-[#F0F0E8]/50 font-mono">
                          <div>Mult: <span className="text-[#C19A6B] font-semibold">{sk.percentage}</span></div>
                          <div>SP Cost: <span className="text-[#C19A6B] font-semibold">{sk.spCost}</span></div>
                          <div>Cast: <span className="text-[#C19A6B] font-semibold">{sk.castTime}</span></div>
                          <div>CD: <span className="text-[#C19A6B] font-semibold">{sk.cooldown}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mt-5 pt-4 border-t border-[#2A2A2A] flex-1">
                      <p className="text-xs text-[#F0F0E8]/70 leading-relaxed line-clamp-3">
                        {sk.description || "Tidak ada deskripsi yang tersedia untuk skill ini."}
                      </p>
                    </div>

                    {/* Interactive Inline Damage Calculator */}
                    <div className="mt-4 pt-4 border-t border-[#2A2A2A]/60 bg-[#0F0F0F] p-3 border border-[#2A2A2A]/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-[#C19A6B] font-semibold flex items-center gap-1">
                          <Calculator className="w-3.5 h-3.5" />
                          Simulasi Damage
                        </span>
                        <span className="text-[10px] text-[#F0F0E8]/40 font-mono">Formula Dasar</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            value={skillAtkInput[sk.id!] !== undefined ? skillAtkInput[sk.id!] : 1000}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setSkillAtkInput(prev => ({ ...prev, [sk.id!]: val }));
                            }}
                            placeholder="ATK/MATK"
                            className="w-full bg-[#1A1A1A] text-[#F0F0E8] border border-[#2A2A2A] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#C19A6B] rounded-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#F0F0E8]/40 font-mono">ATK</span>
                        </div>
                        
                        {/* Simulation Output */}
                        <div className="text-right shrink-0 bg-[#1A1A1A] px-3 py-1 border border-[#2A2A2A] min-w-[90px]">
                          <div className="text-[8px] text-[#F0F0E8]/40 font-mono uppercase tracking-wider">Est. DMG</div>
                          <div className="text-xs font-bold font-mono text-[#C19A6B]">
                            {(() => {
                              const atk = skillAtkInput[sk.id!] !== undefined ? skillAtkInput[sk.id!] : 1000;
                              // Clean up multiplier (e.g. "1250%" -> 1250, "+30%" -> 30)
                              const cleanedPct = sk.percentage.replace(/[^0-9.]/g, "");
                              const multiplierPercent = parseFloat(cleanedPct) || 100;
                              const calculatedDmg = Math.round(atk * (multiplierPercent / 100));
                              return calculatedDmg.toLocaleString();
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: NEW PATCH ==================== */}
        {activeTab === "patch" && (
          <div className="max-w-4xl mx-auto">
            {filteredPatches.length === 0 ? (
              <div className="text-center py-16 bg-[#1A1A1A] border border-[#2A2A2A]">
                <BookOpen className="w-12 h-12 text-[#C19A6B]/50 mx-auto mb-2" />
                <p className="text-[#F0F0E8]/50 text-sm font-serif italic">Belum ada pengumuman patch baru.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredPatches.map((pt) => (
                  <article key={pt.id} className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C19A6B] transition-all duration-300 p-6 sm:p-8 relative group">
                    {isAdmin && (
                      <div className="absolute top-6 right-6 flex gap-1 bg-[#0F0F0F] p-1 border border-[#2A2A2A]">
                        <button 
                          onClick={() => openEditForm("patch", pt)}
                          className="p-1 text-[#C19A6B] hover:text-[#0F0F0F] hover:bg-[#C19A6B] transition"
                          title="Edit Patch"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem("new_patches", pt.id!)}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-600/60 transition"
                          title="Hapus Patch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      {pt.imageBase64 && (
                        <img 
                          src={pt.imageBase64} 
                          alt={pt.title}
                          referrerPolicy="no-referrer"
                          className="w-full md:w-56 h-36 rounded-none object-cover bg-[#0F0F0F] border border-[#2A2A2A] shrink-0"
                        />
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2.5 text-[10px] font-mono text-[#F0F0E8]/50 uppercase tracking-wider">
                          <span>{pt.date}</span>
                          <span>•</span>
                          <span>Oleh {pt.author}</span>
                        </div>

                        <h3 className="text-2xl font-serif italic font-bold text-[#F0F0E8] group-hover:text-[#C19A6B] transition duration-200 mb-3">
                          {pt.title}
                        </h3>

                        <p className="text-xs sm:text-sm text-[#F0F0E8]/70 leading-relaxed whitespace-pre-wrap mb-4">
                          {pt.content}
                        </p>

                        {/* Tags */}
                        {pt.tags && pt.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {pt.tags.map(tag => (
                              <span key={tag} className="text-[10px] bg-[#2A2A2A] text-[#C19A6B] border border-[#333] font-mono px-2 py-0.5">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: MAPS ==================== */}
        {activeTab === "maps" && (
          <div>
            {filteredMaps.length === 0 ? (
              <div className="text-center py-16 bg-[#1A1A1A] border border-[#2A2A2A]">
                <MapPin className="w-12 h-12 text-[#C19A6B]/50 mx-auto mb-2" />
                <p className="text-[#F0F0E8]/50 text-sm font-serif italic">Tidak ada peta yang ditemukan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMaps.map((mp) => (
                  <div key={mp.id} className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C19A6B] transition-all duration-300 group relative flex flex-col h-full">
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1 bg-[#0F0F0F] p-1 border border-[#2A2A2A] z-10">
                        <button 
                          onClick={() => openEditForm("maps", mp)}
                          className="p-1 text-[#C19A6B] hover:text-[#0F0F0F] hover:bg-[#C19A6B] transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem("maps", mp.id!)}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-600/60 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Image Header */}
                    <div className="h-44 bg-slate-950 relative overflow-hidden">
                      {mp.imageBase64 ? (
                        <img 
                          src={mp.imageBase64} 
                          alt={mp.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-all duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#F0F0E8]/30 font-mono text-sm uppercase">
                          No map image
                        </div>
                      )}
                      {/* Floating level badge */}
                      <div className="absolute bottom-3 left-3 bg-[#C19A6B] text-[#0F0F0F] font-mono font-bold text-[10px] px-3 py-1 border border-[#C19A6B] shadow-md uppercase tracking-wider">
                        Level: Lvl {mp.minLevel}+
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-serif italic font-bold text-[#F0F0E8] group-hover:text-[#C19A6B] transition duration-200 mb-2">
                          {mp.name}
                        </h3>
                        <p className="text-xs text-[#F0F0E8]/70 leading-relaxed mb-4">{mp.description}</p>
                      </div>

                      {/* Monsters */}
                      <div className="pt-4 border-t border-[#2A2A2A]">
                        <h4 className="text-[11px] uppercase font-bold tracking-widest text-[#F0F0E8]/40 font-mono mb-2">Daftar Monster Umum:</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {mp.monsterList.map((monster) => (
                            <span key={monster} className="text-[11px] bg-[#2A2A2A] border border-[#333] text-[#C19A6B] px-2.5 py-0.5 font-mono font-semibold">
                              {monster}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: CARDS ==================== */}
        {activeTab === "cards" && (
          <div>
            {filteredCards.length === 0 ? (
              <div className="text-center py-16 bg-[#1A1A1A] border border-[#2A2A2A]">
                <CreditCard className="w-12 h-12 text-[#C19A6B]/50 mx-auto mb-2" />
                <p className="text-[#F0F0E8]/50 text-sm font-serif italic">Tidak ada kartu yang ditemukan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCards.map((cd) => (
                  <div key={cd.id} className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C19A6B] transition-all duration-300 flex flex-col h-full group relative p-5">
                    
                    {isAdmin && (
                      <div className="absolute top-3 right-3 flex gap-1 bg-[#0F0F0F] p-1 border border-[#2A2A2A] z-10">
                        <button 
                          onClick={() => openEditForm("cards", cd)}
                          className="p-1 text-[#C19A6B] hover:text-[#0F0F0F] hover:bg-[#C19A6B] transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem("cards", cd.id!)}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-600/60 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Card Layout Graphic */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] bg-[#2A2A2A] border border-[#3A3A3A] text-[#C19A6B] px-2.5 py-0.5 font-mono tracking-wider font-semibold">
                          Slot: {cd.slot}
                        </span>
                        <span className="text-[10px] font-mono text-[#F0F0E8]/40">Classic Collection</span>
                      </div>

                      {/* Main card design */}
                      <div className="flex gap-4">
                        {cd.imageBase64 ? (
                          <img 
                            src={cd.imageBase64} 
                            alt={cd.name}
                            referrerPolicy="no-referrer"
                            className="w-16 h-24 rounded-none object-cover bg-[#0F0F0F] border border-[#2A2A2A] shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-24 rounded-none bg-[#0F0F0F] flex items-center justify-center text-[#C19A6B]/50 shrink-0 border border-[#2A2A2A]">
                            <CreditCard className="w-8 h-8" />
                          </div>
                        )}
                        
                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif italic font-bold text-[#F0F0E8] group-hover:text-[#C19A6B] transition leading-snug text-lg">{cd.name}</h3>
                          <div className="mt-1 text-[11px] font-mono text-[#F0F0E8]/50">
                            Drop: <span className="text-[#C19A6B] font-semibold">{cd.sourceMonster || "TBA"}</span>
                          </div>
                          
                          <div className="mt-3.5 bg-[#0F0F0F] border border-[#2A2A2A] p-2.5 text-[11px] font-mono text-[#C19A6B]">
                            Stats: {cd.stats || "MaxHP +100"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-[#2A2A2A]">
                        <p className="text-xs text-[#F0F0E8]/70 leading-relaxed italic font-serif">
                          "{cd.effect}"
                        </p>
                      </div>

                      {/* Upgrade Levels Section */}
                      <div className="mt-4 pt-4 border-t border-[#2A2A2A] space-y-2">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#C19A6B] font-semibold">Efek Upgrade Tingkat</h4>
                        <div className="grid grid-cols-1 gap-1.5 text-[11px] font-mono">
                          <div className="flex items-start gap-2 bg-[#0F0F0F] p-1.5 border border-[#2A2A2A]/40">
                            <span className="text-[#C19A6B] font-bold shrink-0">LV 5:</span>
                            <span className="text-[#F0F0E8]/80">{cd.lvl5Effect || "Stat Dasar Meningkat"}</span>
                          </div>
                          <div className="flex items-start gap-2 bg-[#0F0F0F] p-1.5 border border-[#2A2A2A]/40">
                            <span className="text-[#C19A6B] font-bold shrink-0">LV 10:</span>
                            <span className="text-[#F0F0E8]/80">{cd.lvl10Effect || "Stat Dasar Meningkat + Efek Unik"}</span>
                          </div>
                          <div className="flex items-start gap-2 bg-[#0F0F0F] p-1.5 border border-[#2A2A2A]/40">
                            <span className="text-[#C19A6B] font-bold shrink-0">LV 15:</span>
                            <span className="text-[#F0F0E8]/80">{cd.lvl15Effect || "Efek Maksimal Terbuka"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: MVP & MINI ==================== */}
        {activeTab === "mvp" && (
          <div>
            {filteredMvps.length === 0 ? (
              <div className="text-center py-16 bg-[#1A1A1A] border border-[#2A2A2A]">
                <Skull className="w-12 h-12 text-[#C19A6B]/50 mx-auto mb-2" />
                <p className="text-[#F0F0E8]/50 text-sm font-serif italic">Tidak ada boss monster yang terdaftar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMvps.map((boss) => {
                  const timer = getSpawnStatusText(boss);
                  return (
                    <div key={boss.id} className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#C19A6B] transition-all duration-300 group flex flex-col h-full relative p-5">
                      
                      {isAdmin && (
                        <div className="absolute top-3 right-3 flex gap-1 bg-[#0F0F0F] p-1 border border-[#2A2A2A] z-10">
                          <button 
                            onClick={() => openEditForm("mvp", boss)}
                            className="p-1 text-[#C19A6B] hover:text-[#0F0F0F] hover:bg-[#C19A6B] transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteItem("mvps", boss.id!)}
                            className="p-1 text-red-400 hover:text-white hover:bg-red-600/60 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Header visual info with boss photo */}
                      <div className="h-32 bg-slate-950 relative overflow-hidden mb-4 border border-[#2A2A2A]">
                        {boss.imageBase64 ? (
                          <img 
                            src={boss.imageBase64} 
                            alt={boss.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover opacity-80"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#C19A6B]">
                            <Skull className="w-10 h-10 text-[#C19A6B]/50" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 shadow uppercase tracking-wider ${
                            boss.type === "MVP" ? "bg-red-950/80 text-red-400 border border-red-900/40" : "bg-blue-950/80 text-blue-400 border border-blue-900/40"
                          }`}>
                            {boss.type}
                          </span>
                          <span className="text-[10px] bg-[#0F0F0F] border border-[#2A2A2A] text-[#F0F0E8]/80 font-mono font-bold px-2 py-0.5 shadow">
                            Lvl {boss.level}
                          </span>
                        </div>
                      </div>

                      {/* Boss Info Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-serif italic font-bold text-[#F0F0E8] text-xl group-hover:text-[#C19A6B] transition leading-tight mb-3.5">
                            {boss.name}
                          </h3>

                          {/* Stat badges */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#F0F0E8]/60 mb-4 bg-[#0F0F0F] p-3 border border-[#2A2A2A]">
                            <div>Ras: <span className="text-[#C19A6B] font-semibold">{boss.race}</span></div>
                            <div>Elemen: <span className="text-[#C19A6B] font-semibold">{boss.element}</span></div>
                            <div>Ukuran: <span className="text-[#C19A6B] font-semibold">{boss.size}</span></div>
                            <div>Waktu Spawn: <span className="text-[#C19A6B] font-semibold">{boss.spawnTime}m</span></div>
                          </div>

                          <div className="text-xs text-[#F0F0E8]/70 mb-4">
                            <span className="text-[#F0F0E8]/40 block uppercase text-[9px] tracking-widest font-mono mb-1">Lokasi Utama:</span>
                            <span className="font-medium text-[#F0F0E8] flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#C19A6B]" />
                              {boss.location || "Prontera Field"}
                            </span>
                          </div>

                          {/* Drops */}
                          <div className="mb-4">
                            <span className="text-[#F0F0E8]/40 block uppercase text-[9px] tracking-widest font-mono mb-1.5">Rekomendasi Drops:</span>
                            <div className="flex flex-wrap gap-1">
                              {boss.drops.map(item => (
                                <span key={item} className="text-[10px] bg-[#2A2A2A] border border-[#3A3A3A] text-[#C19A6B] px-2.5 py-0.5 font-mono">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* COLLABORATIVE TIMER COMPONENT */}
                        <div className="pt-4 border-t border-[#2A2A2A] flex flex-col gap-3">
                          <div className={`p-3 border text-center text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            timer.class.includes("bg-emerald-") 
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/30 font-mono" 
                              : timer.class.includes("bg-rose-") 
                              ? "bg-red-950/40 text-red-400 border-red-900/30 font-mono" 
                              : "bg-[#0F0F0F] text-[#C19A6B] border-[#2A2A2A] font-mono"
                          }`}>
                            <Clock className="w-4 h-4" />
                            <span>{timer.text}</span>
                          </div>
                          <button
                            onClick={() => recordBossDeath(boss.id!)}
                            className="w-full text-center bg-[#C19A6B] hover:bg-[#A98458] text-[#0F0F0F] text-xs font-bold py-2.5 px-4 rounded-none uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>Catat Kematian (Killed Now!)</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 6: DAMAGE CALCULATION ==================== */}
        {activeTab === "calc" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Input Controls Panel */}
            <div className="bg-[#1A1A1A] p-6 border border-[#2A2A2A] lg:col-span-5 space-y-6">
              <div className="border-b border-[#2A2A2A] pb-4">
                <h3 className="text-xl font-serif italic font-bold text-[#C19A6B] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#C19A6B]" />
                  Konfigurasi Parameter
                </h3>
                <p className="text-xs text-[#F0F0E8]/50 mt-1">Sesuaikan statistik karakter dan target monster ROOC di bawah ini.</p>
              </div>

              {/* Job Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-2 font-mono">Kelas Karakter (Job)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Lord Knight", "Assassin Cross", 
                    "High Wizard", "Sniper", 
                    "High Priest", "Whitesmith"
                  ].map(job => (
                    <button
                      key={job}
                      onClick={() => {
                        setCalcJob(job as any);
                        // Auto populate some templates for realistic RO calculations
                        if (job === "Lord Knight") { setCalcBaseAtk(1350); setCalcSkillMult(350); }
                        else if (job === "Assassin Cross") { setCalcBaseAtk(1600); setCalcSkillMult(420); }
                        else if (job === "High Wizard") { setCalcBaseAtk(1100); setCalcSkillMult(800); }
                        else if (job === "Sniper") { setCalcBaseAtk(1400); setCalcSkillMult(280); }
                        else if (job === "High Priest") { setCalcBaseAtk(900); setCalcSkillMult(180); }
                        else if (job === "Whitesmith") { setCalcBaseAtk(1550); setCalcSkillMult(600); }
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-none border text-left transition-all ${
                        calcJob === job 
                          ? "bg-[#C19A6B]/10 border-[#C19A6B] text-[#C19A6B] font-serif italic font-extrabold ring-1 ring-[#C19A6B]/20" 
                          : "bg-[#0F0F0F] hover:bg-[#151515] border-[#2A2A2A] text-[#F0F0E8]/70"
                      }`}
                    >
                      {job}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Base ATK / MATK</label>
                  <input
                    type="number"
                    value={calcBaseAtk}
                    onChange={(e) => setCalcBaseAtk(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono font-mono">Skill Mult (%)</label>
                  <input
                    type="number"
                    value={calcSkillMult}
                    onChange={(e) => setCalcSkillMult(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Bonus Kartu (%)</label>
                  <input
                    type="number"
                    value={calcCardBoost}
                    onChange={(e) => setCalcCardBoost(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono font-mono">Flat Bonus</label>
                  <input
                    type="number"
                    value={calcFlatBonus}
                    onChange={(e) => setCalcFlatBonus(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                  />
                </div>
              </div>

              {/* Enemy Modifiers */}
              <div className="border-t border-[#2A2A2A] pt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase text-[#F0F0E8]/40 tracking-widest font-mono">Modifier Target Musuh</h4>
                
                <div>
                  <label className="block text-xs font-semibold text-[#F0F0E8]/70 mb-1.5 font-mono">Ukuran Musuh (Size Mod)</label>
                  <select
                    value={calcEnemySize}
                    onChange={(e) => setCalcEnemySize(Number(e.target.value))}
                    className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#C19A6B]"
                  >
                    <option value="1.0">Medium (100% Damage)</option>
                    <option value="0.75">Small (75% Damage)</option>
                    <option value="0.5">Very Small (50% Damage)</option>
                    <option value="1.2">Large (120% Damage - Size Penalty bypassed)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#F0F0E8]/70 mb-1.5 font-mono">Kelemahan Elemen</label>
                    <select
                      value={calcEnemyElement}
                      onChange={(e) => setCalcEnemyElement(Number(e.target.value))}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#C19A6B]"
                    >
                      <option value="1.0">Netral (100%)</option>
                      <option value="1.5">Konter Elemen (150%)</option>
                      <option value="2.0">Konter Elemen Kuat (200%)</option>
                      <option value="0.5">Kebal Parsial (50%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#F0F0E8]/70 mb-1.5 font-mono font-mono">Bonus Ras Target</label>
                    <select
                      value={calcEnemyRace}
                      onChange={(e) => setCalcEnemyRace(Number(e.target.value))}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#C19A6B]"
                    >
                      <option value="1.0">Normal (100%)</option>
                      <option value="1.1">Demi-Human (+10%)</option>
                      <option value="1.2">Demon (+20%)</option>
                      <option value="1.3">Undead / Insect (+30%)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F0F0E8]/70 mb-1.5 font-mono">Pertahanan Fisik Target (DEF)</label>
                  <input
                    type="range"
                    min="0"
                    max="800"
                    step="10"
                    value={calcEnemyDef}
                    onChange={(e) => setCalcEnemyDef(Number(e.target.value))}
                    className="w-full accent-[#C19A6B]"
                  />
                  <div className="flex justify-between text-[10px] text-[#F0F0E8]/40 font-mono mt-1 font-bold">
                    <span>Lembek (0 DEF)</span>
                    <span className="text-[#C19A6B]">Saat Ini: {calcEnemyDef} DEF (~{Math.round((calcEnemyDef / (calcEnemyDef + 600)) * 100)}% Reduksi)</span>
                    <span>Tebal (800 DEF)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Output Panel */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Retro Damage Floating Text Screen */}
              <div className="bg-[#0F0F0F] border border-[#2A2A2A] p-8 text-center text-[#F0F0E8] relative overflow-hidden h-80 flex flex-col items-center justify-center">
                
                {/* Visual grid background lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />
                
                <span className="text-[#C19A6B] font-mono text-xs uppercase tracking-widest bg-[#C19A6B]/10 px-3 py-1 border border-[#C19A6B]/20 z-10">
                  Simulated Floating Damage
                </span>

                <div className="relative mt-6 z-10">
                  {/* Glowing Damage typography */}
                  <h4 className="text-5xl sm:text-7xl font-serif italic font-extrabold text-[#C19A6B] tracking-tighter drop-shadow-[0_4px_12px_rgba(193,154,107,0.3)] select-none">
                    {calculatedDamage.toLocaleString()}
                  </h4>
                  {/* Floating Hit Text */}
                  <span className="absolute -top-6 -right-8 bg-red-950/80 text-red-400 border border-red-900/40 font-mono uppercase tracking-widest text-[10px] px-2.5 py-0.5 rounded-none shadow-md transform rotate-12 font-bold">
                    CRITICAL!
                  </span>
                </div>

                <div className="mt-8 text-xs text-[#F0F0E8]/50 font-mono flex items-center gap-1.5 bg-[#1A1A1A] px-4 py-2 border border-[#2A2A2A] z-10 rounded-none">
                  <Play className="w-3.5 h-3.5 text-[#C19A6B]" />
                  <span>Job {calcJob} mengeksekusi skill terhadap target musuh.</span>
                </div>
              </div>

              {/* RO Formula Breakdown Card */}
              <div className="bg-[#1A1A1A] p-6 border border-[#2A2A2A] space-y-4">
                <h4 className="text-lg font-serif italic font-bold text-[#C19A6B]">Penjelasan Formula Perhitungan Klasik</h4>
                <div className="bg-[#0F0F0F] p-4 text-xs font-mono text-[#F0F0E8]/70 leading-relaxed border border-[#2A2A2A] space-y-2">
                  <p className="font-semibold text-[#F0F0E8]">Rumus Dasar:</p>
                  <p className="bg-[#1A1A1A] p-2.5 border border-[#2A2A2A] text-[#C19A6B] overflow-x-auto">
                    Damage = [((BaseATK * Multiplier) * CardBoost * SizeMod * ElementMod * RaceMod) * (1 - ReduksiDEF)] + FlatBonus
                  </p>
                  <p className="pt-2">Dimana Reduksi DEF berskala non-linear berbasis rumus standar Ragnarok Origin Classic:</p>
                  <p className="text-[#C19A6B] bg-[#1A1A1A] p-2 border border-[#2A2A2A]">
                    Persen Reduksi = DEF / (DEF + 600)
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== TAB 7: ELEMENT CHART ==================== */}
        {activeTab === "elements" && (
          <div className="space-y-8 animate-fade-in">
            {/* Introductory Panel */}
            <div className="bg-[#1A1A1A] p-6 border border-[#2A2A2A]">
              <h3 className="text-xl font-serif italic font-bold text-[#C19A6B] flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-[#C19A6B]" />
                Tabel Efektivitas Elemen (Elemental Effectiveness Matrix)
              </h3>
              <p className="text-xs text-[#F0F0E8]/70 leading-relaxed font-mono">
                Sistem elemen di Ragnarok Origin Classic (ROOC) menentukan bonus damage atau pinalti ketika menyerang target. 
                Penyelarasan elemen senjata dengan kelemahan elemen monster adalah kunci utama untuk melipatgandakan output damage Anda!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Matchup Tester Panel (4 columns) */}
              <div className="bg-[#1A1A1A] p-6 border border-[#2A2A2A] lg:col-span-4 space-y-6">
                <div>
                  <h4 className="text-base font-serif italic font-bold text-[#C19A6B] mb-1">Simulasi Matchup Elemen</h4>
                  <p className="text-xs text-[#F0F0E8]/50">Pilih elemen penyerang dan elemen target untuk melihat multiplier efek langsung.</p>
                </div>

                <div className="space-y-4">
                  {/* Attacking Element */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Elemen Penyerang (Senjata / Skill)</label>
                    <select
                      value={selectedAtkElement}
                      onChange={(e) => setSelectedAtkElement(e.target.value)}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C19A6B] rounded-none"
                    >
                      {ELEMENTS.map((elem) => (
                        <option key={elem} value={elem}>{elem}</option>
                      ))}
                    </select>
                  </div>

                  {/* Defending Element */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Elemen Bertahan (Target Monster)</label>
                    <select
                      value={selectedDefElement}
                      onChange={(e) => setSelectedDefElement(e.target.value)}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C19A6B] rounded-none"
                    >
                      {ELEMENTS.map((elem) => (
                        <option key={elem} value={elem}>{elem}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Matchup Result Box */}
                {(() => {
                  const multiplierStr = ELEMENT_MATRIX[selectedAtkElement]?.[selectedDefElement] || "100%";
                  const multVal = parseInt(multiplierStr) || 100;
                  const isBonus = multVal > 100;
                  const isPenalty = multVal < 100;

                  return (
                    <div className="bg-[#0F0F0F] border border-[#2A2A2A] p-5 text-center space-y-3">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#F0F0E8]/40">Multiplier Kerusakan</div>
                      <div className={`text-4xl font-mono font-bold ${
                        isBonus ? "text-emerald-400" : isPenalty ? "text-red-400" : "text-[#C19A6B]"
                      }`}>
                        {multiplierStr}
                      </div>
                      <div className="text-[11px] font-mono text-[#F0F0E8]/60 leading-relaxed text-left border-t border-[#2A2A2A] pt-3">
                        {isBonus && (
                          <span className="text-emerald-400">▲ Sangat Efektif!</span>
                        )}
                        {isPenalty && (
                          <span className="text-red-400">▼ Kurang Efektif!</span>
                        )}
                        {!isBonus && !isPenalty && (
                          <span className="text-neutral-400">● Efek Normal</span>
                        )}
                        {` Elemen `}
                        <strong className="text-[#C19A6B]">{selectedAtkElement}</strong>
                        {` memberikan damage `}
                        <strong className={isBonus ? "text-emerald-400" : isPenalty ? "text-red-400" : "text-[#C19A6B]"}>
                          {multiplierStr}
                        </strong>
                        {` terhadap target berelemen `}
                        <strong className="text-[#C19A6B]">{selectedDefElement}</strong>.
                      </div>
                    </div>
                  );
                })()}

                {/* Elemental Cycle Quick Info */}
                <div className="bg-[#151515] p-4 border border-[#2A2A2A]/40 text-xs font-mono text-[#F0F0E8]/60 space-y-2">
                  <p className="font-bold text-[#C19A6B] uppercase tracking-wider text-[10px]">Siklus Elemen Utama:</p>
                  <p>• <span className="text-red-400 font-bold">Fire</span> &gt; <span className="text-amber-500 font-bold">Earth</span> (Kelemahan Tanah)</p>
                  <p>• <span className="text-amber-500 font-bold">Earth</span> &gt; <span className="text-cyan-400 font-bold">Wind</span> (Kelemahan Angin)</p>
                  <p>• <span className="text-cyan-400 font-bold">Wind</span> &gt; <span className="text-blue-400 font-bold">Water</span> (Kelemahan Air)</p>
                  <p>• <span className="text-blue-400 font-bold">Water</span> &gt; <span className="text-red-400 font-bold">Fire</span> (Kelemahan Api)</p>
                </div>
              </div>

              {/* Complete Element Matrix Table (8 columns) */}
              <div className="bg-[#1A1A1A] p-6 border border-[#2A2A2A] lg:col-span-8 overflow-hidden">
                <div className="mb-4">
                  <h4 className="text-base font-serif italic font-bold text-[#C19A6B]">Matriks Elemen 10x10 Lengkap</h4>
                  <p className="text-xs text-[#F0F0E8]/50 font-serif italic">Klik sel dalam tabel di bawah ini untuk mensimulasikan kombinasi elemen secara interaktif.</p>
                </div>

                {/* Responsive Matrix Grid */}
                <div className="overflow-x-auto border border-[#2A2A2A] bg-[#0F0F0F]">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#2A2A2A] bg-[#121212]">
                        <th className="p-3 text-center border-r border-[#2A2A2A] text-[#C19A6B] font-bold">Atk \ Def</th>
                        {ELEMENTS.map((colElem) => (
                          <th key={colElem} className="p-2 text-center text-[10px] font-bold min-w-[65px]">
                            <span className="block text-[8px] opacity-40 uppercase">DEF</span>
                            <span className="text-[#C19A6B]">{colElem}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ELEMENTS.map((rowElem) => (
                        <tr key={rowElem} className="border-b border-[#2A2A2A]/40 hover:bg-[#1A1A1A]/50 transition">
                          <td className="p-2.5 font-bold border-r border-[#2A2A2A] bg-[#121212]/80 text-[10px] text-center min-w-[80px]">
                            <span className="block text-[8px] opacity-40 uppercase">ATK</span>
                            <span className="text-[#C19A6B]">{rowElem}</span>
                          </td>
                          {ELEMENTS.map((colElem) => {
                            const valStr = ELEMENT_MATRIX[rowElem]?.[colElem] || "100%";
                            const valInt = parseInt(valStr) || 100;
                            const isBonus = valInt > 100;
                            const isPenalty = valInt < 100;
                            const isCurrentSelected = selectedAtkElement === rowElem && selectedDefElement === colElem;

                            return (
                              <td 
                                key={colElem} 
                                className={`p-2.5 text-center transition cursor-pointer font-bold border-r border-[#2A2A2A]/40 text-[11px] ${
                                  isBonus 
                                    ? "bg-emerald-950/25 text-emerald-400 hover:bg-emerald-900/40" 
                                    : isPenalty 
                                      ? "bg-red-950/15 text-red-400/80 hover:bg-red-900/25" 
                                      : "text-[#F0F0E8]/60 hover:bg-neutral-800/40"
                                } ${
                                  isCurrentSelected 
                                    ? "ring-2 ring-[#C19A6B] ring-inset bg-[#C19A6B]/20" 
                                    : ""
                                }`}
                                onClick={() => {
                                  setSelectedAtkElement(rowElem);
                                  setSelectedDefElement(colElem);
                                }}
                                title={`${rowElem} Atk vs ${colElem} Def: ${valStr}`}
                              >
                                {valStr}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend explanation */}
                <div className="flex flex-wrap gap-4 mt-4 text-[10px] font-mono text-[#F0F0E8]/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-emerald-950/40 border border-emerald-900/50 rounded-none" />
                    <span>Damage Meningkat (&gt; 100%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-950/20 border border-red-900/50 rounded-none" />
                    <span>Damage Berkurang (&lt; 100%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#F0F0E8]/60 font-bold">100%</span>
                    <span>Damage Standar / Normal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ==================== DIALOG 1: ADMIN LOGIN MODAL ==================== */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] max-w-sm w-full overflow-hidden rounded-none shadow-2xl animate-scale-up">
            <div className="p-6 bg-[#0F0F0F] text-[#F0F0E8] flex items-center justify-between border-b border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#C19A6B]" />
                <h3 className="text-base font-serif italic font-bold text-[#C19A6B]">Admin Portal Login</h3>
              </div>
              <button 
                onClick={() => { setShowLoginModal(false); setLoginError(""); }}
                className="text-[#F0F0E8]/50 hover:text-[#F0F0E8] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {loginError && (
                <div className="bg-red-950/40 text-red-400 text-xs p-3 rounded-none border border-red-900/30 flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="bg-[#C19A6B]/10 border border-[#C19A6B]/20 p-3.5 text-xs text-[#C19A6B] space-y-1.5 rounded-none font-mono">
                <p className="font-bold uppercase tracking-wider text-[10px]">Prototype Credentials:</p>
                <p>Username: <strong className="font-mono bg-[#C19A6B]/20 px-1.5 py-0.5 rounded text-[#F0F0E8]">adm</strong></p>
                <p>Password: <strong className="font-mono bg-[#C19A6B]/20 px-1.5 py-0.5 rounded text-[#F0F0E8]">123</strong></p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Username</label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Username..."
                  className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Password</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password..."
                  className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                />
              </div>

              <button
                type="submit"
                id="btn-submit-login"
                className="w-full bg-[#C19A6B] hover:bg-[#A98458] text-[#0F0F0F] transition font-bold uppercase tracking-widest py-3 text-xs rounded-none cursor-pointer"
              >
                Masuk Sekarang
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DIALOG 2: CRUD FORM MODAL ==================== */}
      {showFormModal && formType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-40 overflow-y-auto">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] max-w-2xl w-full my-8 overflow-hidden flex flex-col rounded-none shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-6 bg-[#0F0F0F] text-[#F0F0E8] flex items-center justify-between border-b border-[#2A2A2A]">
              <div>
                <h3 className="text-lg font-serif italic font-bold text-[#C19A6B]">
                  {editingId ? "Ubah Data" : "Tambah Data"} {formType.toUpperCase()}
                </h3>
                <p className="text-xs text-[#F0F0E8]/50 mt-1">Lengkapi formulir di bawah ini dengan presisi.</p>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="text-[#F0F0E8]/50 hover:text-[#F0F0E8] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              
              {/* ==================== FORM AI SCANNER SECTION ==================== */}
              {(formType === "skills" || formType === "cards") && (
                <div className="bg-[#0F0F0F] p-4 border border-dashed border-[#2A2A2A] space-y-4 rounded-none">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-[#C19A6B] shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-[#C19A6B]">
                        Bantuan AI Screenshot Auto-Scanner (OCR)
                      </h4>
                      <p className="text-[11px] text-[#F0F0E8]/60 leading-normal mt-1">
                        Unggah gambar tangkapan layar (screenshot) status skill atau kartu di game. AI kami akan secara otomatis membaca dan mengisi seluruh isian formulir di bawah ini dalam sekejap!
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                    {/* Choose screenshot */}
                    <div className="w-full sm:w-auto relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setScannedImagePreview)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      />
                      <button
                        type="button"
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-transparent border border-[#2A2A2A] hover:bg-[#2A2A2A] transition text-[#C19A6B] text-xs font-bold uppercase tracking-wider py-2 px-4 rounded-none cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Pilih Screenshot
                      </button>
                    </div>

                    {/* Scan Trigger Button */}
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => triggerAIScan(formType === "skills" ? "skill" : "card")}
                      className={`w-full sm:w-auto flex items-center justify-center gap-1.5 transition font-bold py-2.5 px-4 rounded-none text-xs uppercase tracking-wider cursor-pointer ${
                        scannedImagePreview 
                          ? "bg-[#C19A6B] hover:bg-[#A98458] text-[#0F0F0F]" 
                          : "bg-[#2A2A2A] text-[#F0F0E8]/30 cursor-not-allowed border border-[#333]"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Scan dengan AI
                    </button>

                    {scannedImagePreview && (
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        ✓ Gambar siap dipindai
                      </span>
                    )}
                  </div>

                  {/* Scan Status Log with loading spinner */}
                  {isScanning && (
                    <div className="bg-[#000] text-[#F0F0E8]/80 p-3 text-[11px] font-mono flex items-center gap-2 border border-[#2A2A2A] shadow-inner">
                      <RefreshCw className="w-3.5 h-3.5 text-[#C19A6B] animate-spin" />
                      <span className="animate-pulse">{scanStatus}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== FIELD SUB-FORMS ==================== */}

              {/* 1. Skill Form Fields */}
              {formType === "skills" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Nama Skill</label>
                      <input
                        type="text"
                        required
                        value={skillName}
                        onChange={(e) => setSkillName(e.target.value)}
                        placeholder="Contoh: Bowling Bash"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Tipe Skill</label>
                      <select
                        value={skillType}
                        onChange={(e) => setSkillType(e.target.value as any)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      >
                        <option value="PDMG">PDMG (Physical Damage)</option>
                        <option value="MDMG">MDMG (Magic Damage)</option>
                        <option value="Support">Support / Recovery</option>
                        <option value="Passive">Passive Buff</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Multiplier Damage (%)</label>
                      <input
                        type="text"
                        value={skillPercentage}
                        onChange={(e) => setSkillPercentage(e.target.value)}
                        placeholder="Contoh: 250% atau +30%"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Cooldown</label>
                      <input
                        type="text"
                        value={skillCooldown}
                        onChange={(e) => setSkillCooldown(e.target.value)}
                        placeholder="Contoh: 1.5s atau None"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Cast Time</label>
                      <input
                        type="text"
                        value={skillCastTime}
                        onChange={(e) => setSkillCastTime(e.target.value)}
                        placeholder="Contoh: Instant atau 0.5s"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">SP Cost</label>
                      <input
                        type="text"
                        value={skillSpCost}
                        onChange={(e) => setSkillSpCost(e.target.value)}
                        placeholder="Contoh: 15 SP"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Job Class (Kelas Pekerjaan)</label>
                    <select
                      value={skillJob}
                      onChange={(e) => setSkillJob(e.target.value)}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    >
                      {["Swordsman", "Knight", "Mage", "Wizard", "Acolyte", "Priest", "Archer", "Hunter", "Thief", "Assassin", "Merchant", "Blacksmith", "Bard / Dancer", "Novice / General"].map((job) => (
                        <option key={job} value={job}>{job}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Deskripsi Skill</label>
                    <textarea
                      required
                      value={skillDescription}
                      onChange={(e) => setSkillDescription(e.target.value)}
                      placeholder="Masukkan detail mekanik skill..."
                      rows={4}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    />
                  </div>

                  {/* Standard Image Upload */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Unggah Icon / Gambar Skill (Base64)</label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setSkillImage)}
                        className="text-xs text-[#F0F0E8]/70"
                      />
                      {skillImage && (
                        <img 
                          src={skillImage} 
                          alt="preview" 
                          className="w-12 h-12 object-cover rounded-none border border-[#C19A6B]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Patch Form Fields */}
              {formType === "patch" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Judul Patch</label>
                      <input
                        type="text"
                        required
                        value={patchTitle}
                        onChange={(e) => setPatchTitle(e.target.value)}
                        placeholder="Contoh: Update Patch v1.1"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Tanggal Publikasi</label>
                      <input
                        type="date"
                        required
                        value={patchDate}
                        onChange={(e) => setPatchDate(e.target.value)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Label / Tags (Pemisah Koma)</label>
                      <input
                        type="text"
                        value={patchTags}
                        onChange={(e) => setPatchTags(e.target.value)}
                        placeholder="Contoh: Balance, Knight, Update"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Penulis (Author)</label>
                      <input
                        type="text"
                        required
                        value={patchAuthor}
                        onChange={(e) => setPatchAuthor(e.target.value)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Konten Berita</label>
                    <textarea
                      required
                      value={patchContent}
                      onChange={(e) => setPatchContent(e.target.value)}
                      placeholder="Masukkan penjelasan lengkap rilis patch..."
                      rows={6}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Unggah Banner Patch (Base64)</label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setPatchImage)}
                        className="text-xs text-[#F0F0E8]/70"
                      />
                      {patchImage && (
                        <img 
                          src={patchImage} 
                          alt="preview" 
                          className="w-20 h-10 object-cover rounded-none border border-[#C19A6B]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Map Form Fields */}
              {formType === "maps" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Nama Peta (Map Name)</label>
                      <input
                        type="text"
                        required
                        value={mapName}
                        onChange={(e) => setMapName(e.target.value)}
                        placeholder="Contoh: Payon Cave F1"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Rekomendasi Level Minimal</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="120"
                        value={mapMinLevel}
                        onChange={(e) => setMapMinLevel(Number(e.target.value))}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Daftar Monster (Pemisah Koma)</label>
                    <input
                      type="text"
                      required
                      value={mapMonsters}
                      onChange={(e) => setMapMonsters(e.target.value)}
                      placeholder="Contoh: Zombie, Spore, Poporing"
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Deskripsi Wilayah</label>
                    <textarea
                      required
                      value={mapDescription}
                      onChange={(e) => setMapDescription(e.target.value)}
                      placeholder="Jelaskan lingkungan, lore, atau rute peta..."
                      rows={4}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Unggah Visual Ilustrasi Peta (Base64)</label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setMapImage)}
                        className="text-xs text-[#F0F0E8]/70"
                      />
                      {mapImage && (
                        <img 
                          src={mapImage} 
                          alt="preview" 
                          className="w-20 h-10 object-cover rounded-none border border-[#C19A6B]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Card Form Fields */}
              {formType === "cards" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Nama Kartu</label>
                      <input
                        type="text"
                        required
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Contoh: Poring Card"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Slot Penempatan</label>
                      <select
                        value={cardSlot}
                        onChange={(e) => setCardSlot(e.target.value)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      >
                        <option value="Weapon">Weapon (Senjata)</option>
                        <option value="Armor">Armor (Baju Zirah)</option>
                        <option value="Shield">Shield (Perisai)</option>
                        <option value="Garment">Garment (Jubah)</option>
                        <option value="Shoes">Shoes (Sepatu)</option>
                        <option value="Accessory">Accessory (Aksesoris)</option>
                        <option value="Headwear">Headwear (Topi)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Ringkasan Statistik (Stats)</label>
                      <input
                        type="text"
                        required
                        value={cardStats}
                        onChange={(e) => setCardStats(e.target.value)}
                        placeholder="Contoh: MaxHP +100, LUK +2"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Monster Drop (Source)</label>
                      <input
                        type="text"
                        required
                        value={cardSourceMonster}
                        onChange={(e) => setCardSourceMonster(e.target.value)}
                        placeholder="Contoh: Poring"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Deskripsi Efek Lengkap</label>
                    <textarea
                      required
                      value={cardEffect}
                      onChange={(e) => setCardEffect(e.target.value)}
                      placeholder="Masukkan detail mekanik efek pasif kartu..."
                      rows={3}
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#2A2A2A]/50 pt-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Upgrade Lvl 5 Effect</label>
                      <input
                        type="text"
                        value={cardLvl5Effect}
                        onChange={(e) => setCardLvl5Effect(e.target.value)}
                        placeholder="MaxHP +200"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Upgrade Lvl 10 Effect</label>
                      <input
                        type="text"
                        value={cardLvl10Effect}
                        onChange={(e) => setCardLvl10Effect(e.target.value)}
                        placeholder="MaxHP +400, LUK +4"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Upgrade Lvl 15 Effect</label>
                      <input
                        type="text"
                        value={cardLvl15Effect}
                        onChange={(e) => setCardLvl15Effect(e.target.value)}
                        placeholder="MaxHP +800, LUK +6, DEF +5"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Unggah Gambar Ilustrasi Kartu (Base64)</label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setCardImage)}
                        className="text-xs text-[#F0F0E8]/70"
                      />
                      {cardImage && (
                        <img 
                          src={cardImage} 
                          alt="preview" 
                          className="w-12 h-16 object-cover rounded-none border border-[#C19A6B]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. MVP/Mini Boss Form Fields */}
              {formType === "mvp" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Nama Boss</label>
                      <input
                        type="text"
                        required
                        value={bossName}
                        onChange={(e) => setBossName(e.target.value)}
                        placeholder="Contoh: Baphomet"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Tipe Boss</label>
                      <select
                        value={bossType}
                        onChange={(e) => setBossType(e.target.value as any)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      >
                        <option value="MVP">MVP (Major Boss)</option>
                        <option value="Mini">Mini Boss</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Level Boss</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="150"
                        value={bossLevel}
                        onChange={(e) => setBossLevel(Number(e.target.value))}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Elemen</label>
                      <select
                        value={bossElement}
                        onChange={(e) => setBossElement(e.target.value)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      >
                        {["Neutral", "Fire", "Water", "Wind", "Earth", "Poison", "Holy", "Shadow", "Ghost", "Undead"].map((elem) => (
                          <option key={elem} value={elem}>{elem}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Ukuran (Size)</label>
                      <select
                        value={bossSize}
                        onChange={(e) => setBossSize(e.target.value)}
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      >
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Ras (Race)</label>
                      <input
                        type="text"
                        required
                        value={bossRace}
                        onChange={(e) => setBossRace(e.target.value)}
                        placeholder="e.g. Demon, Angel"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Interval Spawn (Menit)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={bossSpawnTime}
                        onChange={(e) => setBossSpawnTime(e.target.value)}
                        placeholder="Contoh: 120"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Wilayah Spawn (Map)</label>
                      <input
                        type="text"
                        required
                        value={bossLocation}
                        onChange={(e) => setBossLocation(e.target.value)}
                        placeholder="Contoh: Glast Heim"
                        className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Rekomendasi Drops (Pemisah Koma)</label>
                    <input
                      type="text"
                      required
                      value={bossDrops}
                      onChange={(e) => setBossDrops(e.target.value)}
                      placeholder="Contoh: Baphomet Card, Crescent Scythe, Elunium"
                      className="w-full bg-[#0F0F0F] text-[#F0F0E8] border border-[#2A2A2A] rounded-none px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#C19A6B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#F0F0E8]/40 mb-1.5 font-mono">Unggah Foto Boss (Base64)</label>
                    <div className="flex gap-4 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setBossImage)}
                        className="text-xs text-[#F0F0E8]/70"
                      />
                      {bossImage && (
                        <img 
                          src={bossImage} 
                          alt="preview" 
                          className="w-20 h-10 object-cover rounded-none border border-[#C19A6B]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions Footer */}
              <div className="pt-6 border-t border-[#2A2A2A] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-transparent hover:bg-[#2A2A2A] text-[#F0F0E8]/60 font-bold py-2.5 px-5 rounded-none text-xs uppercase tracking-wider cursor-pointer border border-[#2A2A2A]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="btn-save-submit"
                  className="bg-[#C19A6B] hover:bg-[#A98458] text-[#0F0F0F] font-bold py-2.5 px-6 rounded-none text-xs uppercase tracking-wider cursor-pointer border border-[#C19A6B]"
                >
                  Simpan Perubahan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modern Compact Footer */}
      <footer className="bg-[#121212] text-[#F0F0E8]/50 py-12 border-t border-[#2A2A2A] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <p className="text-base font-serif italic font-bold text-[#C19A6B] tracking-wide">
            Ragnarok Origin Classic Community Database — Berdaya AI Sandbox
          </p>
          <p className="text-xs text-[#F0F0E8]/40 max-w-lg mx-auto leading-relaxed font-mono">
            Platform ini merupakan purwarupa sistem manajemen database komunitas Ragnarok Origin Classic (ROOC) dengan dukungan OCR multi-model fallback Gemini bertenaga tinggi.
          </p>
          <p className="text-[10px] text-[#F0F0E8]/30 pt-2 font-mono">
            © 2026 ROOC Database Sandbox. Ragnarok Online dan seluruh aset merek dagang adalah milik Gravity Co., Ltd.
          </p>
        </div>
      </footer>

    </div>
  );
}
