import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
} from "./real-active-mens-roster.js";
import {
  REAL_ACTIVE_WOMENS_ROSTER_NAMES,
} from "./real-active-womens-roster.js";
import type {
  InitialRosterAssignment,
  InitialRosterAssignmentSource,
} from "../../sim-core/src/initial-roster-assignments.js";

export const NJPW_STARDOM_ROSTER_SEED_REVIEWED_ON = "2026-10-08";

export const NJPW_PRIMARY_ROSTER_NAMES = [
  "Aaron Wolf",
  "Boltin Oleg",
  "Callum Newman",
  "Clark Connors",
  "DOUKI",
  "Daiki Nagai",
  "David Finlay",
  "Dick Togo",
  "Drilla Moloney",
  "El Desperado",
  "El Phantasmo",
  "Francesco Akira",
  "Gabe Kidd",
  "Gedo",
  "Great-O-Khan",
  "HENARE",
  "Hartley Jackson",
  "Hirooki Goto",
  "Jado",
  "Jake Lee",
  "Kushida",
  "Katsuya Murashima",
  "Kosei Fujita",
  "Masatora Yasuda",
  "Master Wato",
  "Mikey Nicholls",
  "OSKAR",
  "Ren Narita",
  "Robbie Eagles",
  "Robbie X",
  "Rocky Romero",
  "Ryohei Oiwa",
  "Ryusuke Taguchi",
  "SANADA",
  "SHO",
  "Satoshi Kojima",
  "Shane Haste",
  "Shingo Takagi",
  "Shoma Kato",
  "Shota Umino",
  "TAKA Michinoku",
  "Taichi",
  "Taiji Ishimori",
  "Taisei Nakahara",
  "Tatsuya Matsumoto",
  "Togi Makabe",
  "Tomoaki Honma",
  "Tomohiro Ishii",
  "Toru Yano",
  "YOH",
  "YOSHI-HASHI",
  "Yoshinobu Kanemaru",
  "Yota Tsuji",
  "Yuji Nagata",
  "Yujiro Takahashi",
  "Yushin Hatazawa",
  "Yuto-Ice",
  "Yuya Uemura",
  "Zack Sabre Jr.",
  "Zane Jay",
] as const;

export const STARDOM_PRIMARY_ROSTER_NAMES = [
  "Hanan",
  "Saya Iida",
  "Momo Kohgo",
  "Yuria Hime",
  "Matoi Hamabe",
  "Maika",
  "Waka Tsukiyama",
  "HANAKO",
  "Utami Hayashishita",
  "Aya Sakura",
  "Sayaka Kurei",
  "Natsupoi",
  "Saori Anou",
  "Yuna Mizumori",
  "Anne Kanaya",
  "Syuri",
  "Ami Sohrei",
  "Ranna Yagami",
  "Hina",
  "Lady C",
  "Tomoka Inaba",
  "Kiyoka Kotatsu",
  "Starlight Kid",
  "AZM",
  "Mei Seira",
  "Miyu Amasaki",
  "Ema Maishima",
  "Natsuko Tora",
  "Momo Watanabe",
  "Konami",
  "Saya Kamitani",
  "Ruaka",
  "Rina",
  "Bea Priestley",
  "Azusa Inaba",
  "Fukigen Death",
  "Suzu Suzuki",
  "Rina Yamashita",
  "Itsuki Aoki",
  "Bozilla",
  "Tetsu Akira",
  "Hazuki",
  "Koguma",
  "Rian",
  "Kikyo Furusawa",
  "Fuwa-chan",
  "Maki Itoh",
] as const;

const men = new Set(REAL_ACTIVE_MENS_ROSTER_NAMES);
const women = new Set(REAL_ACTIVE_WOMENS_ROSTER_NAMES);

for (const name of NJPW_PRIMARY_ROSTER_NAMES) {
  if (!men.has(name)) throw new Error(`NJPW roster seed references unknown wrestler ${name}`);
}
for (const name of STARDOM_PRIMARY_ROSTER_NAMES) {
  if (!women.has(name)) throw new Error(`STARDOM roster seed references unknown wrestler ${name}`);
}
if (new Set(NJPW_PRIMARY_ROSTER_NAMES).size !== NJPW_PRIMARY_ROSTER_NAMES.length) {
  throw new Error("NJPW roster seed contains duplicate identities");
}
if (new Set(STARDOM_PRIMARY_ROSTER_NAMES).size !== STARDOM_PRIMARY_ROSTER_NAMES.length) {
  throw new Error("STARDOM roster seed contains duplicate identities");
}

/**
 * Current active-core Japanese promotion seed.
 *
 * PPW starts these rosters on flexible deals because the modeled ecosystem
 * must permit outside work and future cross-promotion. This is a simulation
 * default, not a claim about private contract language.
 *
 * Outside guests already owned elsewhere in PPW (for example AEW talent
 * appearing on NJPW cards) are intentionally not reassigned here.
 */
export const njpwStardomInitialRosterAssignmentSource: InitialRosterAssignmentSource = ({
  people,
  promotions,
}) => {
  const personByName = new Map(people.map((person) => [person.name, person]));
  const njpw = promotions.find((promotion) => promotion.name === "NJPW");
  const stardom = promotions.find((promotion) => promotion.name === "STARDOM");
  if (!njpw || !stardom) throw new Error("NJPW/STARDOM roster seed requires both promotions");

  const assignments: InitialRosterAssignment[] = [];
  for (const name of NJPW_PRIMARY_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`NJPW initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: njpw.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: njpw.id,
        role: "PRIMARY",
        basis: "CONTRACT",
      }],
    });
  }
  for (const name of STARDOM_PRIMARY_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`STARDOM initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: stardom.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: stardom.id,
        role: "PRIMARY",
        basis: "CONTRACT",
      }],
    });
  }
  return assignments;
};
