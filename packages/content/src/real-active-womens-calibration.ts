import type { CareerStage, Person } from "../../domain/src/types.js";
import type { RealRosterValueBand } from "./real-active-mens-calibration.js";
import { REAL_ACTIVE_WOMENS_ROSTER_NAMES } from "./real-active-womens-roster.js";

export const REAL_ACTIVE_WOMENS_CALIBRATION_VERSION = "2026-10-08-a";

type ValueBandConfig = {
  popularity: readonly [number, number];
  recognition: readonly [number, number];
  inRing: readonly [number, number];
  matchCraft: readonly [number, number];
  presentation: readonly [number, number];
};

function setFromText(text: string): Set<string> {
  return new Set(text.trim().split("\n").filter(Boolean));
}

const VALUE_BANDS: Record<RealRosterValueBand, ValueBandConfig> = {
  MEGASTAR: { popularity: [90, 97], recognition: [91, 98], inRing: [72, 92], matchCraft: [74, 94], presentation: [80, 96] },
  HEADLINER: { popularity: [78, 90], recognition: [76, 91], inRing: [66, 89], matchCraft: [66, 90], presentation: [68, 91] },
  FEATURED: { popularity: [61, 78], recognition: [56, 79], inRing: [58, 84], matchCraft: [58, 85], presentation: [57, 82] },
  REGULAR: { popularity: [39, 62], recognition: [34, 64], inRing: [48, 78], matchCraft: [47, 79], presentation: [43, 76] },
  PROSPECT: { popularity: [22, 47], recognition: [14, 43], inRing: [43, 72], matchCraft: [40, 70], presentation: [38, 69] },
};

const MEGASTARS = setFromText(`Mercedes Moné
Toni Storm
Rhea Ripley
IYO SKY
Becky Lynch
Charlotte Flair
Bianca Belair
Bayley`);

const HEADLINERS = setFromText(`Saya Kamitani
Tiffany Stratton
Stephanie Vaquer
Athena
Sareee
Liv Morgan
Nia Jax
Starlight Kid
Kris Statlander
Jordynne Grace
Mayu Iwatani
Giulia
Roxanne Perez
Mina Shirakawa
Willow Nightingale
Chelsea Green
Asuka
Jade Cargill
Jamie Hayter
Hikaru Shida
Britt Baker D.M.D.
Thunder Rosa
Syuri
Momo Watanabe
Maika
Utami Hayashishita
Tessa Blanchard
AJ Lee`);

const FEATURED = setFromText(`Jacy Jayne
Lyra Valkyria
Sol Ruca
Blake Monroe
Nina Samuels
Zeuxis
AZM
Alex Windsor
Megan Bayne
Rhio
Kenzie Paige
Takumi Iroha
Zelina
Kelani Jordan
Fallon Henley
Miu Watanabe
Jody Threat
Natsupoi
Dani Luna
Thekla
Queen Aminata
Lola Vice
Flammer
Persephone
Red Velvet
Deonna Purrazzo
Billie Starkz
Trish Adora
Shotzi Blackheart
Masha Slamovich
Indi Hartwell
Xia Brookside
Tasha Steelz
Miyu Yamashita
Chihiro Hashimoto
Mizuki
Suzu Suzuki
Mei Seira
Natsuko Tora
Saori Anou
MIRAI
Taya Valkyrie
Serena Deeb
Marina Shafir
Yuka Sakazaki
Maki Itoh`);

const PROSPECT_VALUE = setFromText(`Kendal Grey
Thea Hail
Wren Sinclair
Zaria
Jaida Parker
Kiana James
Maxxine Dupri
Miyu Amasaki
Ema Maishima
Rian
Kikyo Furusawa
Matoi Hamabe
Tetsu Akira
Hikari Minami
Kaho Matsushita`);

const SPECIAL_ATTRACTIONS = setFromText(`AJ Lee
Brie Bella
Nikki Bella
Paige`);

const VETERANS = setFromText(`Becky Lynch
Bayley
Charlotte Flair
Asuka
Nattie
Nia Jax
Hikaru Shida
Thunder Rosa
Taya Valkyrie
Serena Deeb
Syuri
Britt Baker D.M.D.
Rosemary`);

const PROSPECT_STAGE = new Set([
  ...PROSPECT_VALUE,
  "Billie Starkz",
]);

const WORKRATE_ACES = setFromText(`Mercedes Moné
Toni Storm
Rhea Ripley
IYO SKY
Athena
Sareee
Mayu Iwatani
Saya Kamitani
Stephanie Vaquer
Giulia
Syuri
AZM
Starlight Kid
Momo Watanabe
Utami Hayashishita
Miyu Yamashita
Chihiro Hashimoto
Takumi Iroha
Mizuki
Suzu Suzuki
Mei Seira
Asuka
Bianca Belair
Jordynne Grace`);

const PRESENTATION_ACES = setFromText(`Mercedes Moné
Toni Storm
Rhea Ripley
Becky Lynch
Charlotte Flair
Bianca Belair
Bayley
Tiffany Stratton
Liv Morgan
Chelsea Green
Athena
Britt Baker D.M.D.
Jade Cargill
AJ Lee
Stephanie Vaquer
Nia Jax`);

const KNOWN_ROSTER_NAMES = new Set(REAL_ACTIVE_WOMENS_ROSTER_NAMES);

function assertKnownNames(label: string, names: ReadonlySet<string>): void {
  for (const name of names) {
    if (!KNOWN_ROSTER_NAMES.has(name)) throw new Error(`${label} women's calibration references unknown wrestler ${name}`);
  }
}

function assertDisjointValueBands(): void {
  const seen = new Set<string>();
  for (const [label, names] of [
    ["MEGASTAR", MEGASTARS],
    ["HEADLINER", HEADLINERS],
    ["FEATURED", FEATURED],
    ["PROSPECT", PROSPECT_VALUE],
  ] as const) {
    assertKnownNames(label, names);
    for (const name of names) {
      if (seen.has(name)) throw new Error(`women's value calibration assigns ${name} to multiple bands`);
      seen.add(name);
    }
  }
}

assertDisjointValueBands();
assertKnownNames("SPECIAL_ATTRACTION", SPECIAL_ATTRACTIONS);
assertKnownNames("VETERAN", VETERANS);
assertKnownNames("PROSPECT_STAGE", PROSPECT_STAGE);
assertKnownNames("WORKRATE", WORKRATE_ACES);
assertKnownNames("PRESENTATION", PRESENTATION_ACES);

function hashText(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function deterministicInt(name: string, salt: string, min: number, max: number): number {
  const span = Math.max(1, max - min + 1);
  return min + (hashText(`${name}:${salt}`) % span);
}

function deterministicDecimal(name: string, salt: string, min: number, max: number): number {
  const raw = deterministicInt(name, salt, 0, 10_000) / 10_000;
  return Math.round((min + (max - min) * raw) * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function blendedStat(base: number, name: string, salt: string, range: readonly [number, number]): number {
  const target = deterministicInt(name, salt, range[0], range[1]);
  return clamp(Math.round(base * 0.2 + target * 0.8), range[0], range[1]);
}

export function realWomensRosterValueBand(name: string): RealRosterValueBand {
  if (MEGASTARS.has(name)) return "MEGASTAR";
  if (HEADLINERS.has(name)) return "HEADLINER";
  if (FEATURED.has(name)) return "FEATURED";
  if (PROSPECT_VALUE.has(name)) return "PROSPECT";
  return "REGULAR";
}

function calibratedCareerStage(name: string): CareerStage {
  if (SPECIAL_ATTRACTIONS.has(name)) return "SPECIAL_ATTRACTION";
  if (VETERANS.has(name)) return "VETERAN";
  if (PROSPECT_STAGE.has(name)) return "PROSPECT";
  return "PRIME";
}

function ageRange(stage: CareerStage): readonly [number, number] {
  switch (stage) {
    case "PROSPECT": return [20.5, 25.5];
    case "PRIME": return [26, 34.5];
    case "VETERAN": return [35.5, 45];
    case "SPECIAL_ATTRACTION": return [43.5, 52];
  }
}

function experienceRange(stage: CareerStage): readonly [number, number] {
  switch (stage) {
    case "PROSPECT": return [10, 34];
    case "PRIME": return [42, 72];
    case "VETERAN": return [72, 92];
    case "SPECIAL_ATTRACTION": return [86, 98];
  }
}

function developmentRange(stage: CareerStage): readonly [number, number] {
  switch (stage) {
    case "PROSPECT": return [72, 95];
    case "PRIME": return [48, 82];
    case "VETERAN": return [36, 68];
    case "SPECIAL_ATTRACTION": return [30, 58];
  }
}

function wearRange(stage: CareerStage): readonly [number, number] {
  switch (stage) {
    case "PROSPECT": return [0, 10];
    case "PRIME": return [5, 24];
    case "VETERAN": return [15, 40];
    case "SPECIAL_ATTRACTION": return [24, 50];
  }
}

export function calibrateRealActiveWomensPerson(person: Person): Person {
  const name = person.name;
  const band = realWomensRosterValueBand(name);
  const config = VALUE_BANDS[band];
  const stage = calibratedCareerStage(name);
  const age = ageRange(stage);
  const experience = experienceRange(stage);
  const development = developmentRange(stage);
  const wear = wearRange(stage);

  let inRingQuality = blendedStat(person.skills.inRingQuality, name, "women-in-ring", config.inRing);
  let matchCraft = blendedStat(person.skills.matchCraft, name, "women-craft", config.matchCraft);
  let presentation = blendedStat(person.skills.presentation, name, "women-presentation", config.presentation);

  if (WORKRATE_ACES.has(name)) {
    inRingQuality = Math.max(inRingQuality, deterministicInt(name, "women-workrate-ace", 87, 96));
    matchCraft = Math.max(matchCraft, deterministicInt(name, "women-craft-ace", 85, 96));
  }
  if (PRESENTATION_ACES.has(name)) {
    presentation = Math.max(presentation, deterministicInt(name, "women-presentation-ace", 87, 97));
  }

  const staminaCap = stage === "SPECIAL_ATTRACTION" ? 75 : stage === "VETERAN" ? 84 : 96;

  return {
    ...person,
    careerStage: stage,
    biologicalAge: deterministicDecimal(name, "women-age", age[0], age[1]),
    careerExperience: deterministicInt(name, "women-experience", experience[0], experience[1]),
    developmentAptitude: deterministicInt(name, "women-development", development[0], development[1]),
    wear: deterministicInt(name, "women-wear", wear[0], wear[1]),
    recognition: deterministicInt(name, "women-recognition", config.recognition[0], config.recognition[1]),
    popularity: deterministicInt(name, "women-popularity", config.popularity[0], config.popularity[1]),
    skills: {
      ...person.skills,
      inRingQuality,
      matchCraft,
      stamina: Math.min(person.skills.stamina, staminaCap),
      presentation,
    },
  };
}
