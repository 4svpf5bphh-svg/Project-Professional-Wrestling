/**
 * Reviewed active women's wrestler identity pool.
 *
 * Reviewed 2026-10-07 against current official WWE/NXT, AEW/ROH, TNA,
 * CMLL/AAA and STARDOM roster/event sources. This file is identity data only:
 * promotion assignments, contract terms and calibrated simulation attributes
 * are deliberately separate concerns.
 */
export const REAL_ACTIVE_WOMENS_ROSTER_REVIEWED_ON = "2026-10-08";

const REAL_ACTIVE_WOMENS_ROSTER_TEXT = `AJ Lee
Alexa Bliss
Arianna Grace
Asuka
B-Fab
Bayley
Becky Lynch
Bianca Belair
Blake Monroe
Brie Bella
Candice LeRae
Charlotte Flair
Chelsea Green
Fallon Henley
Giulia
IYO SKY
Ivy Nile
Jacy Jayne
Jade Cargill
Jaida Parker
Jordynne Grace
Kairi Sane
Kelani Jordan
Kendal Grey
Kiana James
Lash Legend
Liv Morgan
Lola Vice
Lyra Valkyria
Maxxine Dupri
Nattie
Nia Jax
Nikki Bella
Nikkita Lyons
Paige
Raquel Rodriguez
Rhea Ripley
Roxanne Perez
Sol Ruca
Stephanie Vaquer
Thea Hail
Tiffany Stratton
Wren Sinclair
Zaria
Zelina
Alex Windsor
Deonna Purrazzo
Hyan
Kris Statlander
Maya World
Nyla Rose
Red Velvet
Tay Melo
Willow Nightingale
Anna Jay
Diamante
Jamie Hayter
Leila Grey
Megan Bayne
Penelope Ford
Riho
Taya Valkyrie
Yuka Sakazaki
Athena
Emi Sakura
Kamille
Madison Rayne
Mina Shirakawa
Queen Aminata
Serena Deeb
Thunder Rosa
Dani Luna
Hikaru Shida
Marina Shafir
Skye Blue
Toni Storm
Mercedes Moné
Persephone
Thekla
Zayda Steel
Britt Baker D.M.D.
Harley Cameron
Julia Hart
Lena Kross
Ruby Soho
Alisha Edwards
Allie
Ash By Elegance
Xia Brookside
Kiera Hogan
M By Elegance
Elayna Black
Rosemary
Heather By Elegance
Masha Slamovich
Indi Hartwell
Jody Threat
Tasha Steelz
Léi Yǐng Lee
Zoey Serrano
Mara Sadé
Jada Stone
Olympia
Zeuxis
Dark Silueta
Reyna Isis
Keyra
Hera
Sanely
Candela
Princesa Sugehit
Tabata
Nexy
Metálica
Valkyria
Alexius
Feroz
Lluvia
Hécate
India Sioux
La Catalina
Lady Shani
Flammer
La Hiedra
Adelicious
Syuri
Ami Sohrei
Ranna Yagami
Hina
Lady C
Tomoka Inaba
Kiyoka Kotatsu
Starlight Kid
AZM
Mei Seira
Miyu Amasaki
Ema Maishima
Natsuko Tora
Momo Watanabe
Konami
Saya Kamitani
Ruaka
Rina
Bea Priestley
Azusa Inaba
Fukigen Death
Suzu Suzuki
Rina Yamashita
Itsuki Aoki
Bozilla
Hazuki
Koguma
Rian
Kikyo Furusawa
Maki Itoh
Hanan
Saya Iida
Momo Kohgo
Yuria Hime
Aya Sakura
Sayaka Kurei
Natsupoi
Saori Anou
Yuna Mizumori
Anne Kanaya
Maika
HANAKO
Waka Tsukiyama
Utami Hayashishita
Fuwa-chan
Akari
Matoi Hamabe
Tetsu Akira`;

export const REAL_ACTIVE_WOMENS_ROSTER_NAMES: readonly string[] =
  REAL_ACTIVE_WOMENS_ROSTER_TEXT.split("\n");

const normalizedNames = REAL_ACTIVE_WOMENS_ROSTER_NAMES.map((name) => name.toLocaleLowerCase("en"));
if (new Set(normalizedNames).size !== REAL_ACTIVE_WOMENS_ROSTER_NAMES.length) {
  throw new Error("real-active women's roster contains duplicate display names");
}
