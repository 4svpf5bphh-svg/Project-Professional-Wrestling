import type { CareerStage, Person } from "../../domain/src/types.js";
import type { WorldRosterSource } from "../../sim-core/src/roster-source.js";
import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
  realActiveMensRosterSource,
} from "./real-active-mens-roster.js";

export const REAL_ACTIVE_MENS_CALIBRATION_VERSION = "2026-10-04-a";

export type RealRosterValueBand = "MEGASTAR" | "HEADLINER" | "FEATURED" | "REGULAR" | "PROSPECT";

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

const MEGASTARS = setFromText(`Cody Rhodes
Roman Reigns
CM Punk
Seth Rollins
Randy Orton
Gunther
Drew McIntyre
Jey Uso
MJF
Jon Moxley
Kenny Omega
Will Ospreay
Kazuchika Okada
Swerve Strickland
"Hangman" Adam Page
Samoa Joe
Orange Cassidy
Místico
Zack Sabre Jr.
LA Knight`);

const HEADLINERS = setFromText(`Dominik Mysterio
Kevin Owens
Sami Zayn
Damian Priest
Bron Breakker
Jacob Fatu
Penta
Rey Fenix
Rey Mysterio
Logan Paul
Rusev
Trick Williams
Oba Femi
Ilja Dragunov
Carmelo Hayes
Adam Cole
Adam Copeland
Bobby Lashley
Christian Cage
Darby Allin
Claudio Castagnoli
Jay White
Bandido
Konosuke Takeshita
Kyle Fletcher
Mark Briscoe
Ricochet
Rush
Chris Jericho
Shelton Benjamin
Hijo del Vikingo
Psycho Clown
Máscara Dorada
Shingo Takagi
Yota Tsuji
David Finlay
Gabe Kidd
SANADA
El Desperado
KENTA
Joe Hendry
Moose
Nic Nemeth
Mustafa Ali
Josh Alexander
Matt Cardona
Matt Riddle
Michael Oku
Jeff Hardy
Matt Hardy
MVP`);

const FEATURED = setFromText(`Austin Theory
Angelo Dawkins
Bronson Reed
Chad Gable
Dragon Lee
Ethan Page
Finn Bálor
Grayson Waller
Ivar
JD McDonagh
Jimmy Uso
Johnny Gargano
Julius Creed
Montez Ford
Nathan Frazer
Noam Dar
Omos
Otis
Ricky Saints
Shinsuke Nakamura
Solo Sikoa
Tama Tonga
Tony D'Angelo
Ace Austin
Alex Shelley
Andrade El Ídolo
Anthony Bowens
AR Fox
Austin Gunn
The Beast Mortos
Brody King
Buddy Matthews
Cash Wheeler
Chris Sabin
Clark Connors
Colten Gunn
Daniel Garcia
Dante Martin
Dax Harwood
Dustin Rhodes
Eddie Kingston
Hook
Jay Lethal
Juice Robinson
Jack Perry
Katsuyori Shibata
Kevin Knight
Komander
Kota Ibushi
Kyle O'Reilly
Lance Archer
Lee Moriarty
Lio Rush
Luchasaurus
Mark Davis
Max Caster
Mike Bennett
Myron Reed
Alex Zayne
Great-O-Khan
HENARE
Hirooki Goto
Kosei Fujita
Master Wato
Robbie Eagles
Ryohei Oiwa
SHO
Shota Umino
Taichi
Taiji Ishimori
Tomohiro Ishii
YOH
YOSHI-HASHI
Yuya Uemura
Templario
AJ Francis
Brian Myers
Cedric Alexander
Eddie Edwards
Elijah
Frankie Kazarian
Leon Slater
Laredo Kid
Pagano
Killer Kross
Tom Lawlor
Joey Janela
Josh Barnett
Jack Cartwheel
Zack Gibson
Luke Jacobs
Mark Andrews
Zak Knight
Keith Lee
Tommaso Ciampa
Tyler Breeze`);

const PROSPECT_VALUE = setFromText(`Blake Howard
Brad Baylor
Cutler James
Dion Lennox
Dorian Van Dux
EK Prosper
Elio LeFleur
Hank Walker
Jackson Drake
Jasper Troy
Je'Von Evans
Kam Hendrix
Keanu Carver
Lucien Price
Mark Nash
Mason Rook
Myles Borne
Niko Vance
Osiris Griffin
Ricky Smokes
Romeo Moreno
Royce Keys
Saquon Shugars
Sean Legacy
Shiloh Hill
Tank Ledger
Tate Wilder
Tavion Heights
Tristan Angels
Daiki Nagai
Katsuya Murashima
Masatora Yasuda
Shoma Kato
Taisei Nakahara
Tatsuya Matsumoto
Yushin Hatazawa
Yuto-Ice
Zane Jay
Aaron Wolf
Uriah Connors
Braxton Cole
Harley Riggins
Jax Presley
Shido Ash
Cappuccino Jones
Chazz "Starboy" Hall
CJ Valor
Elijah Holyfield
Harlem Lewis`);

const SPECIAL_ATTRACTIONS = setFromText(`Billy Gunn
Jeff Jarrett
Chris Jericho
R-Truth
Rey Mysterio
Dustin Rhodes
Matt Hardy
Jeff Hardy
Hiroyoshi Tenzan
Togi Makabe
Yuji Nagata
Satoshi Kojima
TAKA Michinoku
Super Crazy
Ricky Morton
MVP`);

const VETERANS = setFromText(`CM Punk
Randy Orton
The Miz
Kevin Owens
Sami Zayn
Shinsuke Nakamura
Adam Copeland
Christian Cage
Bobby Lashley
Shelton Benjamin
Claudio Castagnoli
Jay Lethal
Colt Cabana
Johnny TV
Samoa Joe
Katsuyori Shibata
Kota Ibushi
Lance Archer
Rocky Romero
Hirooki Goto
Tomohiro Ishii
Tomoaki Honma
Toru Yano
Yoshinobu Kanemaru
Yujiro Takahashi
KENTA
Taichi
Taiji Ishimori
Naomichi Marufuji
Kazuyuki Fujita
Masato Tanaka
Eddie Edwards
Frankie Kazarian
Nic Nemeth
Matt Cardona
Tom Lawlor
Josh Barnett
Tyler Breeze`);

const PROSPECT_STAGE = new Set([
  ...PROSPECT_VALUE,
  "Leon Slater",
  "Kosei Fujita",
  "Ryohei Oiwa",
]);

const WORKRATE_ACES = setFromText(`Will Ospreay
Kenny Omega
Zack Sabre Jr.
Kazuchika Okada
Gunther
Ilja Dragunov
Konosuke Takeshita
Kyle Fletcher
Bandido
Místico
Hijo del Vikingo
Shingo Takagi
Yota Tsuji
Tomohiro Ishii
KENTA
El Desperado
Claudio Castagnoli
Chris Sabin
Alex Shelley
Michael Oku
Luke Jacobs
Ricochet
Chad Gable
Finn Bálor
Johnny Gargano
Nathan Frazer
Dragon Lee
Rey Fenix
Penta`);

const PRESENTATION_ACES = setFromText(`Cody Rhodes
Roman Reigns
CM Punk
Seth Rollins
Randy Orton
LA Knight
Drew McIntyre
Gunther
Jey Uso
Dominik Mysterio
MJF
Swerve Strickland
Jon Moxley
"Hangman" Adam Page
Samoa Joe
Orange Cassidy
Christian Cage
Adam Copeland
Chris Jericho
Joe Hendry
Trick Williams
Moose
Matt Cardona
Mustafa Ali
Psycho Clown
Logan Paul`);

const KNOWN_ROSTER_NAMES = new Set(REAL_ACTIVE_MENS_ROSTER_NAMES);

function assertKnownNames(label: string, names: ReadonlySet<string>): void {
  for (const name of names) {
    if (!KNOWN_ROSTER_NAMES.has(name)) throw new Error(`${label} calibration references unknown wrestler ${name}`);
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
      if (seen.has(name)) throw new Error(`real-roster value calibration assigns ${name} to multiple bands`);
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

export function realRosterValueBand(name: string): RealRosterValueBand {
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

export function calibrateRealActiveMensPerson(person: Person): Person {
  const name = person.name;
  const band = realRosterValueBand(name);
  const config = VALUE_BANDS[band];
  const stage = calibratedCareerStage(name);
  const age = ageRange(stage);
  const experience = experienceRange(stage);
  const development = developmentRange(stage);
  const wear = wearRange(stage);

  let inRingQuality = blendedStat(person.skills.inRingQuality, name, "in-ring", config.inRing);
  let matchCraft = blendedStat(person.skills.matchCraft, name, "craft", config.matchCraft);
  let presentation = blendedStat(person.skills.presentation, name, "presentation", config.presentation);

  if (WORKRATE_ACES.has(name)) {
    inRingQuality = Math.max(inRingQuality, deterministicInt(name, "workrate-ace", 87, 96));
    matchCraft = Math.max(matchCraft, deterministicInt(name, "craft-ace", 85, 96));
  }
  if (PRESENTATION_ACES.has(name)) {
    presentation = Math.max(presentation, deterministicInt(name, "presentation-ace", 87, 97));
  }

  const staminaCap = stage === "SPECIAL_ATTRACTION" ? 75 : stage === "VETERAN" ? 84 : 96;

  return {
    ...person,
    careerStage: stage,
    biologicalAge: deterministicDecimal(name, "age", age[0], age[1]),
    careerExperience: deterministicInt(name, "experience", experience[0], experience[1]),
    developmentAptitude: deterministicInt(name, "development", development[0], development[1]),
    wear: deterministicInt(name, "wear", wear[0], wear[1]),
    recognition: deterministicInt(name, "recognition", config.recognition[0], config.recognition[1]),
    popularity: deterministicInt(name, "popularity", config.popularity[0], config.popularity[1]),
    skills: {
      ...person.skills,
      inRingQuality,
      matchCraft,
      stamina: Math.min(person.skills.stamina, staminaCap),
      presentation,
    },
  };
}

export const calibratedRealActiveMensRosterSource: WorldRosterSource = (context) => (
  realActiveMensRosterSource(context).map(calibrateRealActiveMensPerson)
);
