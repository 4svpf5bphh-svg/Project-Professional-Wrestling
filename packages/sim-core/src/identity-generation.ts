/**
 * PPW-authored on-screen character foundation.
 *
 * Covers uncatalogued real wrestlers and invented prospects. These move names
 * and gimmick assignments are FICTIONAL EDITORIAL APPROXIMATIONS, never claims
 * about an actual person's repertoire, attributes or private preferences.
 * Deterministic by stable person ID/name and skills; no RNG stream consumed.
 */
import type {Person, WorldState} from "../../domain/src/types.js";
import type {PortableIdentityMove,PortableIdentityPersona,PortableWrestlerIdentity} from "../../domain/src/wrestler-identity.js";
import {deterministicSeedFromText} from "./rng.js";

type Style="ALL_ROUNDER"|"TECHNICAL"|"BRAWLER"|"HIGH_FLYER"|"POWERHOUSE"|"STRIKER"|"SUBMISSION"|"LUCHA"|"STRONG_STYLE";
type Type=PortableIdentityMove["category"];
interface CharacterFormula {
  gimmicks: readonly string[];
  signature:readonly (readonly [string,Type])[];
  finish:readonly (readonly [string,Type])[];
}
const FORMULAS:Record<Style,CharacterFormula>={
  ALL_ROUNDER:{gimmicks:["FAN_FAVOURITE","UNDERDOG","REBEL","SHOWMAN","OPPORTUNIST","ARROGANT_ACE"],
    signature:[["Corner Flash","STRIKE"],["Crescent Suplex","GRAPPLE"],["Rising Knee","STRIKE"],["Springboard Cutter","GRAPPLE"]],
    finish:[["Final Verdict","GRAPPLE"],["Break Point","GRAPPLE"],["Skyline Driver","POWER"],["Last Word","GRAPPLE"]]},
  TECHNICAL:{gimmicks:["RING_GENERAL","TECHNICAL_WIZARD","WRESTLING_MACHINE","SPORTING","SECOND_GENERATION"],
    signature:[["Northern Bridge","GRAPPLE"],["Wristlock Takedown","GRAPPLE"],["Rolling Cradle","GRAPPLE"],["Pendulum Lock","SUBMISSION"]],
    finish:[["Final Equation","SUBMISSION"],["Master's Hold","SUBMISSION"],["Crucifix Driver","GRAPPLE"],["Crossface Clutch","SUBMISSION"]]},
  BRAWLER:{gimmicks:["STREET_FIGHTER","TOUGH_GUY","OUTLAW","BRUISER","PRIZEFIGHTER"],
    signature:[["Ringside Riot","STRIKE"],["Corner Lariat","STRIKE"],["Back Alley Slam","POWER"],["Knuckle Rush","STRIKE"]],
    finish:[["Street Justice","STRIKE"],["Iron Verdict","POWER"],["Last Call","STRIKE"],["Hard Way Driver","POWER"]]},
  HIGH_FLYER:{gimmicks:["HIGH_FLYING_DAREDEVIL","EXTREME_DAREDEVIL","FAN_FAVOURITE","REBEL","CULT_FAVOURITE"],
    signature:[["Rope Runner","AERIAL"],["Cyclone Kick","STRIKE"],["Springboard Splash","AERIAL"],["Airborne Cutter","GRAPPLE"]],
    finish:[["Shooting Comet","AERIAL"],["Summit Dive","AERIAL"],["Skydrop","AERIAL"],["Phoenix Landing","AERIAL"]]},
  POWERHOUSE:{gimmicks:["POWERHOUSE","ENFORCER","MONSTER","BEAST","BRUISER"],
    signature:[["Avalanche Slam","POWER"],["Iron Shoulder","STRIKE"],["Ribbreaker","POWER"],["Impact Clothesline","STRIKE"]],
    finish:[["Mountain Driver","POWER"],["Titan Bomb","POWER"],["Earthshaker","POWER"],["Final Impact","POWER"]]},
  STRIKER:{gimmicks:["PRIZEFIGHTER","BRUISER","STRONG_STYLE_ACE","REBEL","SPORTING"],
    signature:[["Rapid-Fire Elbow","STRIKE"],["Roundhouse Rush","STRIKE"],["Spinning Backfist","STRIKE"],["Knee Barrage","STRIKE"]],
    finish:[["Knockout Point","STRIKE"],["Hammerfall","STRIKE"],["Zero Hour Kick","STRIKE"],["Final Bell","STRIKE"]]},
  SUBMISSION:{gimmicks:["SUBMISSION_SPECIALIST","TECHNICAL_WIZARD","WRESTLING_MACHINE","RING_GENERAL","SPORTING"],
    signature:[["Armtrap Transition","SUBMISSION"],["Rolling Heel Hook","SUBMISSION"],["Cross-Knee Breaker","SUBMISSION"],["Dragon Lock","SUBMISSION"]],
    finish:[["Endgame Clutch","SUBMISSION"],["Last Escape","SUBMISSION"],["Iron Vise","SUBMISSION"],["Final Stretch","SUBMISSION"]]},
  LUCHA:{gimmicks:["LUCHADOR","MASKED_AVENGER","MASKED_MYSTERY","REBEL_LUCHADOR","HIGH_FLYING_DAREDEVIL"],
    signature:[["Tornado Plancha","AERIAL"],["Rope-Walk Rana","GRAPPLE"],["Aztec Kick","STRIKE"],["Springboard Arm Drag","GRAPPLE"]],
    finish:[["Solar Splash","AERIAL"],["Moonfall Driver","GRAPPLE"],["Sky Serpent","AERIAL"],["Lucha Eclipse","AERIAL"]]},
  STRONG_STYLE:{gimmicks:["STRONG_STYLE_ACE","SPORTING","RING_GENERAL","BRUISER","REBEL"],
    signature:[["Fighting Spirit Kick","STRIKE"],["Bridge Suplex","GRAPPLE"],["Shining Elbow","STRIKE"],["Rising Lariat","STRIKE"]],
    finish:[["Warrior's Resolve","STRIKE"],["Fighting Spirit Driver","POWER"],["Final Strike","STRIKE"],["Northern Bomb","POWER"]]},
};
const STYLES=Object.keys(FORMULAS) as Style[];
function choose<T>(items:readonly T[],salt:number):T{return items[salt%items.length]!;}
/** Maps a person to a plausible style using their seeded profile, not random name stereotypes. */
export function authoredWrestlingStyle(person:Person):Style {
  const k=deterministicSeedFromText("ppw:identity:style:"+person.id);
  const candidates:[Style,number][]=[
    ["ALL_ROUNDER",person.skills.inRingQuality+person.skills.matchCraft*0.75],
    ["TECHNICAL",person.skills.matchCraft*1.4+person.skills.safety*0.6],
    ["BRAWLER",person.skills.presentation*1.05+person.skills.stamina*0.6],
    ["HIGH_FLYER",person.skills.stamina*1.25+person.skills.inRingQuality*0.45],
    ["POWERHOUSE",person.skills.presentation*1.1+person.skills.inRingQuality*0.65],
    ["STRIKER",person.skills.inRingQuality*1.15+person.skills.stamina*0.55],
    ["SUBMISSION",person.skills.matchCraft*1.25+person.skills.safety*0.65],
    ["LUCHA",person.skills.stamina*1.1+person.skills.inRingQuality*0.55],
    ["STRONG_STYLE",person.skills.inRingQuality*1.05+person.skills.matchCraft*0.75],
  ];
  return candidates.sort((a,b)=>(b[1]+((k>>>(STYLES.indexOf(b[0])%20))&7)*4)
    -(a[1]+((k>>>(STYLES.indexOf(a[0])%20))&7)*4)
    ||a[0].localeCompare(b[0]))[0]![0];
}
export function authoredPersonaForPerson(person:Person):PortableIdentityPersona {
  const hash=deterministicSeedFromText("ppw:identity:"+person.id+":"+person.name);
  const style=authoredWrestlingStyle(person),formula=FORMULAS[style];
  const secondary=STYLES[(STYLES.indexOf(style)+1+((hash>>>5)%8))%STYLES.length]!;
  const signatures=[
    choose(formula.signature,hash>>>3),
    choose(formula.signature,1+((hash>>>11)%3)),
  ];
  if(signatures[0]![0]===signatures[1]![0])
    signatures[1]=formula.signature.find(x=>x[0]!==signatures[0]![0])!;
  return {
      personaName:person.name,
      gimmickId:choose(formula.gimmicks,hash>>>9),
      primaryStyle:style,
      secondaryStyle:secondary,
      signatureMoves:signatures.map(([name,category])=>({name,category,source:"PPW_AUTHORED"})),
      finishingMoves:[choose(formula.finish,hash>>>16)].map(([name,category])=>({name,category,source:"PPW_AUTHORED"})),
      introducedDate:{...person.debutDate},
      provenance:"GAME_AUTHORED",
  };
}
export function authoredWrestlerIdentity(state:WorldState,person:Person):PortableWrestlerIdentity {
  return {
    worldId:state.world.id,personId:person.id,revision:1,
    active:authoredPersonaForPerson(person),history:[],
  };
}
/** Mutates World state only in explicit genesis, migration and prospect creation. */
export function fillUnassignedWrestlerIdentities(state:WorldState):number {
  const records=(state.wrestlerIdentities??=[]);
  const existing=new Set(records.map(record=>record.personId));
  let added=0;
  for(const person of state.people){
    if(existing.has(person.id))continue;
    records.push(authoredWrestlerIdentity(state,person));
    existing.add(person.id);
    added++;
  }
  return added;
}
