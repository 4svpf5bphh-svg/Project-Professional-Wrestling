import { generatedFictionalRosterSource } from "../../sim-core/src/genesis.js";
import type { WorldRosterSource } from "../../sim-core/src/roster-source.js";

/**
 * Player-facing Alpha roster identity pool.
 *
 * Reviewed 2026-10-04. This first real-roster slice deliberately contains
 * active men's wrestler display identities only. PPW does not yet model gender
 * or divisions, so adding the women's pool before that boundary exists would
 * allow the AI booking engine to create unintended mixed-division matches.
 *
 * Attributes, ages, priorities and contract economics remain the deterministic
 * synthetic values produced by the simulation source for now. This source only
 * replaces display identity; a later calibration slice can tune real-world
 * profile data without coupling it to roster plumbing.
 */
export const REAL_ACTIVE_MENS_ROSTER_REVIEWED_ON = "2026-10-08";

const REAL_ACTIVE_MENS_ROSTER_TEXT = `Aaron Rourke
Akira Tozawa
Angel
Angelo Dawkins
Austin Theory
Axiom
Baron Corbin
Berto
Big Cass
Blake Howard
Brad Baylor
Bravo Americano
Bron Breakker
Bronco Nima
Bronson Reed
Brutus Creed
Carmelo Hayes
Chad Gable
Channing "Stacks" Lorenzo
Charlie Dempsey
CM Punk
Cody Rhodes
Cruz Del Toro
Cruz Montana
Cutler James
Damian Priest
Danhausen
Dion Lennox
Dominik Mysterio
Dorian Van Dux
Dragon Lee
Drew McIntyre
EK Prosper
El Grande Americano
Elio LeFleur
Elton Prince
Erik
Ethan Page
Finn Bálor
Grayson Waller
Gunther
Hank Walker
Ilja Dragunov
Ivar
Jackson Drake
Jacob Fatu
Jasper Troy
JD McDonagh
Je'Von Evans
Jey Uso
Jimmy Uso
Joaquin Wilde
Joe Hendry
Johnny Gargano
Josh Briggs
Julius Creed
Kam Hendrix
Keanu Carver
Kevin Owens
Kit Wilson
LA Knight
Lexis King
Logan Paul
Lucien Price
Mark Nash
Mason Rook
Matt Cardona
The Miz
Montez Ford
Myles Borne
Nathan Frazer
Niko Vance
Noam Dar
Oba Femi
Omos
Osiris Griffin
Otis
Penta
R-Truth
Randy Orton
Rayo Americano
Rey Fenix
Rey Mysterio
Ricky Saints
Ricky Smokes
Roman Reigns
Romeo Moreno
Royce Keys
Rusev
Sami Zayn
Saquon Shugars
Sean Legacy
Seth Rollins
Shawn Spears
Shiloh Hill
Shinsuke Nakamura
Solo Sikoa
Talla Tonga
Tama Tonga
Tank Ledger
Tate Wilder
Tavion Heights
Tony D'Angelo
Trick Williams
Tristan Angels
Aaron Solo
Ace Austin
Action Andretti
Adam Cole
Adam Copeland
Adam Priest
Alec Price
Alex Reynolds
Alex Shelley
Andrade El Ídolo
Angelo Parker
Angélico
Anthony Bowens
Anthony Henry
Anthony Ogogo
AR Fox
Ariya Daivari
Austin Gunn
Bandido
The Beast Mortos
"Big Boom!" A.J.
Billy Gunn
Bishop Kaun
Blake Christian
Bobby Lashley
Brandon Cutler
Brian Cage
Brody King
Bryan Keith
Buddy Matthews
Carlie Bravo
Cash Wheeler
Chris Sabin
Christian Cage
Clark Connors
Claudio Castagnoli
Cole Karter
Colt Cabana
Colten Gunn
Dalton Castle
Daniel Garcia
Dante Martin
Darby Allin
Darius Martin
David Finlay
Dax Harwood
Dezmond Xavier
Dralístico
Dustin Rhodes
Eddie Kingston
El Clon
Evil Uno
Gabe Kidd
Griff Garrison
"Hangman" Adam Page
Hechicero
Hologram
Hook
Isiah Kassidy
Jacked Jameson
Jake Doyle
James Drake
Jay Lethal
Jay White
JD Drake
Jeff Jarrett
Chris Jericho
John Silver
Johnny TV
Jon Moxley
Jordan Oliver
Josh Alexander
Josh Woods
Juice Robinson
Jack Perry
Katsuyori Shibata
Kazuchika Okada
Kenny Omega
Kevin Knight
Kip Sabian
Komander
Konosuke Takeshita
Kota Ibushi
Kyle Fletcher
Kyle O'Reilly
Lance Archer
Lee Johnson
Lee Moriarty
Lio Rush
Luchasaurus
Mansoor
Mark Briscoe
Mark Davis
Marq Quen
Matthew Jackson
Mason Madden
Matt Menard
Matt Sydal
Max Caster
Mike Bennett
MJF
MVP
Myron Reed
Máscara Dorada
Místico
Aaron Wolf
Alex Zayne
Atlantis Jr.
Bad Dude Tito
Boltin Oleg
Callum Newman
Chase Owens
Daiki Nagai
Dick Togo
The DKC
Don Fale
DOUKI
Drilla Moloney
El Desperado
El Phantasmo
Francesco Akira
Fred Rosser
Gedo
Great-O-Khan
Hartley Jackson
HENARE
Hirooki Goto
Hiroyoshi Tenzan
Jado
Jake Lee
Jakob Austin Young
Jorel Nelson
Katsuya Murashima
Kosei Fujita
Kushida
Masatora Yasuda
Master Wato
Matt Vandagriff
Mikey Nicholls
OSKAR
Ren Narita
Robbie Eagles
Robbie X
Rocky Romero
Royce Isaacs
Ryohei Oiwa
Ryusuke Taguchi
SANADA
Satoshi Kojima
Shane Haste
Shingo Takagi
SHO
Shoma Kato
Shota Umino
Taichi
Taiji Ishimori
Taisei Nakahara
TAKA Michinoku
Tatsuya Matsumoto
Templario
AJ Francis
BDE
Bear Bronson
Brian Myers
Cedric Alexander
Chris Bey
Dutch
Eddie Edwards
Elijah
Fabian Aichner
Frankie Kazarian
The Home Town Man
Jason Hotch
Jeff Hardy
John Skyler
KC Navarro
Leon Slater
Matt Hardy
Moose
Mr. Elegance
Mustafa Ali
Nic Nemeth
Rich Swann
Ricky Sosa
Ryan Nemeth
AMAKUSA
Atsushi Kotoge
BUSHI
Doc Gallows
Hi69
Kaito Kiyomiya
Karl Anderson
Kazuyuki Fujita
Kenoh
KENTA
Masato Tanaka
Muhammad Yone
Naomichi Marufuji
OZAWA
Saxon Huxley
Shuhei Taniguchi
Shuji Kondo
Super Crazy
Flip Gordon
La Parkita
Titán
Volador Jr.
El Hijo de Dr. Wagner Jr.
Hijo del Vikingo
La Parka
Laredo Kid
Mr. Iguana
Murder Clown
Octagón Jr.
Pagano
Psycho Clown
Aero Star
Abismo Negro Jr.
Alan Angels
Alex Hammerstone
Andrew Everett
Austin Aries
Big Damo
Donovan Dijak
Jesús Rodríguez
Joe Coffey
Killer Kross
Mark Coffey
Matt Riddle
Tom Lawlor
Will Ospreay
Swerve Strickland
Colin Delaney
Gringo Loco
Gurv Sihra
Harv Sihra
Jack Cartwheel
Joey Janela
Joseph Sawyer
Josh Barnett
Kerry Morton
Orange Cassidy
AJ Cazana
Ricochet
Alex Taylor
Aron Stevens
Bryan Idol
Samoa Joe
Carson Bartholomew Drake
Nicholas Jackson
Rush
Sammy Guevara
Shelton Benjamin
Wheeler Yuta
Toa Liona
Tony Nese
Preston Vance
Turbo Floyd
Joe Cazana
Zack Gibson
Kratos
Shane Taylor
Mike Knox
Mike Mondo
Ortiz
Odinson
Ricky Morton
Flash Morgan Webster
Luke Jacobs
Mark Andrews
Michael Oku
Sha Samuels
Zak Knight
Keith Lee
Leyton Buzzard
Axel Tischer
Mark Haskins
Satnam Singh
Tommy End
Cara Noir
Tommaso Ciampa
Michael Nakazawa
Tyler Breeze
Uriah Connors
Braxton Cole
Harley Riggins
Jax Presley
Nick Comoroto
Shido Ash
Cappuccino Jones
Chazz "Starboy" Hall
CJ Valor
Elijah Holyfield
Harlem Lewis
Zack Sabre Jr.
Togi Makabe
Tomoaki Honma
Tomohiro Ishii
Toru Yano
YOH
YOSHI-HASHI
Yoshinobu Kanemaru
Yota Tsuji
Yuji Nagata
Yujiro Takahashi
Yushin Hatazawa
Yuto-Ice
Yuya Uemura
Zane Jay`;

export const REAL_ACTIVE_MENS_ROSTER_NAMES: readonly string[] = REAL_ACTIVE_MENS_ROSTER_TEXT.split("\n");

const normalizedNames = REAL_ACTIVE_MENS_ROSTER_NAMES.map((name) => name.toLocaleLowerCase("en"));
if (new Set(normalizedNames).size !== REAL_ACTIVE_MENS_ROSTER_NAMES.length) {
  throw new Error("real-active men's roster contains duplicate display names");
}

export const realActiveMensRosterSource: WorldRosterSource = (context) => {
  if (context.ruleset.wrestlers > REAL_ACTIVE_MENS_ROSTER_NAMES.length) {
    throw new Error(
      `real-active men's roster contains ${REAL_ACTIVE_MENS_ROSTER_NAMES.length} names; `
      + `World requested ${context.ruleset.wrestlers}`,
    );
  }

  // Preserve the exact deterministic RNG stream and generated simulation
  // attributes, then overlay real display identities by stable person index.
  const generated = generatedFictionalRosterSource(context);
  return generated.map((person, index) => ({
    ...person,
    name: REAL_ACTIVE_MENS_ROSTER_NAMES[index]!,
  }));
};
