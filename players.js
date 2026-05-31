// ============================================================
//  FOOTBALL DRAFT — PLAYER DATABASE
//
//  POSITIONS KEY:
//    Defence:   GK, LB, CB, RB
//    Midfield:  CDM, CM, CAM  ← all three appear in the MID slot
//    Attack:    LW, RW, ST
//
//  ratings:
//    attack   — used when player fills RW, LW, ST, CAM slot
//    midfield — used when player fills CDM, CM, CAM slot
//    defense  — used when player fills GK, LB, CB, RB, CDM slot
//
//  rarity: "gold" | "silver" | "bronze" | "special"
//  face:   "faces/filename.png"
// ============================================================

const PLAYERS = [

  // ── GOALKEEPERS ───────────────────────────────────────────
  { name:"Thibaut Courtois",      nation:"Belgium",     club:"Real Madrid",       rating:90, attack:18, midfield:54, defense:92, positions:["GK"],           face:"faces/courtois.png",     rarity:"gold"    },
  { name:"Gregor Kobel",          nation:"Switzerland",     club:"Borussia Dortmund",   rating:86, attack:11, midfield:52, defense:87, positions:["GK"],           face:"faces/kobel.png",     rarity:"gold"    },
  { name:"Alisson Becker",        nation:"Brazil",      club:"Liverpool",          rating:90, attack:8,  midfield:12, defense:90, positions:["GK"],           face:"faces/alisson.png",      rarity:"gold"    },
  { name:"Manuel Neuer",          nation:"Germany",     club:"Bayern Munich",      rating:89, attack:10, midfield:14, defense:89, positions:["GK"],           face:"faces/neuer.png",        rarity:"gold"    },
  { name: "Gianluigi Donnarumma", nation:"Italy",     club:"Man City",          rating:89, attack:16,  midfield:50, defense:91, positions:["GK"],           face:"faces/donnarumma.png",    rarity:"gold"    },
  { name:"David Raya",               nation:"Spain",      club:"Arsenal",           rating:88, attack:14, midfield:60, defense:89, positions:["GK"],           face:"faces/raya.png",      rarity:"gold"    },
  { name:"Jordan Pickford",       nation:"England",     club:"Everton",            rating:82, attack:7,  midfield:10, defense:82, positions:["GK"],           face:"faces/pickford.png",     rarity:"gold"  },
  { name:"Mike Maignan",       nation:"France",     club:"AC Milan",             rating:87, attack:15,  midfield:58, defense:88, positions:["GK"],           face:"faces/maignan.png",     rarity:"gold"  },
  { name:"Jan Oblak",       nation:"Slovenia",     club:"Atletico Madrid",         rating:88, attack:12,  midfield:47, defense:89, positions:["GK"],           face:"faces/oblak.png",     rarity:"gold"  },


  // ── RIGHT BACKS ───────────────────────────────────────────
  { name:"Trent Alexander-Arnold",nation:"England",     club:"Liverpool",          rating:87, attack:80, midfield:78, defense:82, positions:["RB"],           face:"faces/trent.png",        rarity:"gold"    },
  { name:"Achraf Hakimi",         nation:"Morocco",     club:"PSG",                rating:89, attack:81, midfield:86, defense:87, positions:["RB"],           face:"faces/hakimi.png",       rarity:"gold"    },
  { name:"Dani Carvajal",         nation:"Spain",       club:"Real Madrid",        rating:85, attack:70, midfield:68, defense:85, positions:["RB"],           face:"faces/carvajal.png",     rarity:"gold"    },
  { name:"Reece James",           nation:"England",     club:"Chelsea",            rating:84, attack:74, midfield:70, defense:83, positions:["RB"],           face:"faces/reecejames.png",   rarity:"gold"    },
  { name:"Kyle Walker",           nation:"England",     club:"Man City",           rating:83, attack:68, midfield:64, defense:83, positions:["RB"],           face:"faces/walker.png",       rarity:"gold"    },
  { name:"Benjamin Pavard",       nation:"France",      club:"Inter Milan",        rating:82, attack:62, midfield:65, defense:82, positions:["RB","CB"],      face:"faces/pavard.png",       rarity:"silver"  },

  // ── LEFT BACKS ────────────────────────────────────────────
  { name:"Alphonso Davies",       nation:"Canada",      club:"Bayern Munich",      rating:86, attack:79, midfield:72, defense:82, positions:["LB"],           face:"faces/davies.png",       rarity:"gold"    },
  { name:"Federico Dimarco",      nation:"Italy",     club:"Inter Milan",       rating:86, attack:81, midfield:85, defense:84, positions:["LB"],           face:"faces/dimarco.png",     rarity:"gold"    },
  { name:"Nuno Mendes",           nation:"Portugal",      club:"PSG",      rating:88, attack:80, midfield:84, defense:87, positions:["LB"],           face:"faces/mendes.png",       rarity:"gold"    },
  { name:"Andrew Robertson",      nation:"Scotland",    club:"Liverpool",          rating:85, attack:72, midfield:74, defense:84, positions:["LB"],           face:"faces/robertson.png",    rarity:"gold"    },
  { name:"Theo Hernandez",        nation:"France",      club:"AC Milan",           rating:85, attack:80, midfield:70, defense:81, positions:["LB"],           face:"faces/theohernandez.png",rarity:"gold"    },
  { name:"Grimaldo",              nation:"Spain",       club:"Bayer Leverkusen",   rating:83, attack:76, midfield:72, defense:80, positions:["LB"],           face:"faces/grimaldo.png",     rarity:"gold"    },
  { name:"Jordi Alba",            nation:"Spain",       club:"Inter Miami",        rating:80, attack:70, midfield:66, defense:79, positions:["LB"],           face:"faces/jordialba.png",    rarity:"silver"  },
  { name:"Ferdi Kadioglu",        nation:"Turkey",      club:"Fenerbahce",         rating:79, attack:70, midfield:68, defense:78, positions:["LB"],           face:"faces/kadioglu.png",     rarity:"silver"  },

  // ── CENTRE BACKS ──────────────────────────────────────────
  { name:"Virgil van Dijk",       nation:"Netherlands", club:"Liverpool",          rating:87, attack:61, midfield:81, defense:89, positions:["CB"],           face:"faces/vandijk.png",      rarity:"gold"    },
  { name:"Jonathan Tah",      nation:"Germany",     club:"Bayern Munich",          rating:87, attack:56, midfield:78, defense:88, positions:["CB"],           face:"faces/tah.png",     rarity:"gold"    },
  { name:"Rúben Dias",            nation:"Portugal",    club:"Man City",           rating:89, attack:35, midfield:50, defense:89, positions:["CB"],           face:"faces/rubendias.png",    rarity:"gold"    },
  { name:"Antonio Rüdiger",       nation:"Germany",     club:"Real Madrid",        rating:87, attack:38, midfield:48, defense:87, positions:["CB"],           face:"faces/rudiger.png",      rarity:"gold"    },
  { name:"William Saliba",        nation:"France",      club:"Arsenal",            rating:88, attack:56, midfield:82, defense:90, positions:["CB"],           face:"faces/saliba.png",       rarity:"gold"    },
  { name:"Gabriel",               nation:"Brazil",      club:"Arsenal",            rating:89, attack:58, midfield:79, defense:91, positions:["CB"],            face:"faces/gabriel.png",       rarity:"gold"    },
  { name:"William Pacho",         nation:"Ecuador",      club:"PSG",            rating:87, attack:54, midfield:79, defense:89, positions:["CB"],               face:"faces/pacho.png",       rarity:"gold"    },
  { name:"Marquinhos",            nation:"Brazil",      club:"PSG",                rating:87, attack:58, midfield:82, defense:88, positions:["CB"],     face:"faces/marquinhos.png",   rarity:"gold"    },
  { name:"Alessandro Bastoni",    nation:"Italy",       club:"Inter Milan",        rating:87, attack:59, midfield:83, defense:89, positions:["CB"],           face:"faces/bastoni.png",      rarity:"gold"    },
  { name:"Eder Militao",          nation:"Brazil",      club:"Real Madrid",        rating:86, attack:30, midfield:44, defense:86, positions:["CB"],           face:"faces/militao.png",      rarity:"gold"    },
  { name:"Kim Min-jae",           nation:"South Korea", club:"Bayern Munich",      rating:86, attack:28, midfield:42, defense:86, positions:["CB"],           face:"faces/kiminjae.png",     rarity:"gold"    },

  // ── CDM ───────────────────────────────────────────────────
  { name:"Rodri",                 nation:"Spain",       club:"Man City",           rating:88, attack:78, midfield:88, defense:87, positions:["CDM"],     face:"faces/rodri.png",        rarity:"gold" },
  { name:"Casemiro",              nation:"Brazil",      club:"Man United",         rating:86, attack:55, midfield:84, defense:84, positions:["CDM"],          face:"faces/casemiro.png",     rarity:"gold"    },
  { name:"Declan Rice",           nation:"England",     club:"Arsenal",            rating:89, attack:79, midfield:89, defense:88, positions:["CDM","CM"],     face:"faces/rice.png",   rarity:"gold"    },
  { name:"Joshua Kimmich",        nation:"Germany",     club:"Bayern Munich",      rating:89, attack:81, midfield:90, defense:85, positions:["CDM"],     face:"faces/kimmich.png",   rarity:"gold"    },
  { name:"Moises Caicedo",        nation:"Ecuador",     club:"Chelsea",          rating:87, attack:76, midfield:87, defense:86, positions:["CDM"],     face:"faces/caicedo.png",   rarity:"gold"    },
  { name:"Aurélien Tchouaméni",   nation:"France",      club:"Real Madrid",        rating:85, attack:58, midfield:83, defense:82, positions:["CDM","CM"],     face:"faces/tchouameni.png",   rarity:"gold"    },
  { name:"Enzo Fernández",        nation:"Argentina",   club:"Chelsea",            rating:84, attack:65, midfield:84, defense:76, positions:["CDM","CM"],     face:"faces/enzo.png",         rarity:"gold"    },
  { name:"Granit Xhaka",          nation:"Switzerland", club:"Bayer Leverkusen",   rating:83, attack:60, midfield:82, defense:78, positions:["CDM","CM"],     face:"faces/xhaka.png",        rarity:"silver"  },

  // ── CM ────────────────────────────────────────────────────
  { name:"Jude Bellingham",       nation:"England",     club:"Real Madrid",        rating:89, attack:87, midfield:90, defense:82, positions:["CM","CAM"],     face:"faces/bellingham.png",   rarity:"gold" },
  { name: "Kevin De Bruyne",       nation:"Belgium",     club:"Man City",           rating:91, attack:86, midfield:91, defense:64, positions:["CM","CAM"],     face:"faces/debruyne.png",     rarity:"gold" },
  { name:"Luka Modric",           nation:"Croatia",     club:"Real Madrid",        rating:88, attack:74, midfield:89, defense:72, positions:["CM"],           face:"faces/modric.png",       rarity:"gold"    },
  { name:"Nicolò Barella",           nation:"Italy",     club:"Inter",        rating:86, attack:80, midfield:88, defense:81, positions:["CM", "CDM"],           face:"faces/barella.png",       rarity:"gold"    },
  { name:"Federico Valverde",     nation:"Uruguay",     club:"Real Madrid",        rating:88, attack:84, midfield:89, defense:83, positions:["CM", "RB"],      face:"faces/valverde.png",        rarity:"gold"    },
  { name:"Martin Ødegaard",       nation:"Norway",      club:"Arsenal",            rating:88, attack:82, midfield:88, defense:60, positions:["CM","CAM"],     face:"faces/odegaard.png",     rarity:"gold"    },
  { name:"Pedri",                 nation:"Spain",       club:"Barcelona",          rating:90, attack:85, midfield:92, defense:74, positions:["CM"],     face:"faces/pedri.png",        rarity:"gold"    },
  { name:"Frenkie De Jong",       nation:"Netherlands",       club:"Barcelona",     rating:87, attack:79, midfield:89, defense:81, positions:["CM", "CDM"],     face:"faces/dejong.png",        rarity:"gold"    },
  { name:"Vitinha",               nation:"Portugal",       club:"PSG",          rating:90, attack:84, midfield:92, defense:78, positions:["CM","CDM"],     face:"faces/vitinha.png",        rarity:"gold"    },
  { name:"Joao Neves",               nation:"Portugal",       club:"PSG",          rating:87, attack:78, midfield:89, defense:84, positions:["CM","CDM"],     face:"faces/neves.png",        rarity:"gold"    },
  { name:"Gavi",                  nation:"Spain",       club:"Barcelona",          rating:87, attack:76, midfield:87, defense:64, positions:["CM"],           face:"faces/gavi.png",         rarity:"gold"    },

  // ── CAM ───────────────────────────────────────────────────
  { name:"Bruno Fernandes",       nation:"Portugal",    club:"Man United",         rating:89, attack:86, midfield:91, defense:71, positions:["CAM","CM"],     face:"faces/fernandes.png",    rarity:"gold"   },
  { name:"Bernardo Silva",        nation:"Portugal",    club:"Man City",           rating:87, attack:82, midfield:86, defense:65, positions:["CAM","CM","RW"],face:"faces/bernardo.png",     rarity:"gold"    },
  { name:"Jamal Musiala",        nation:"Germany",     club:"Bayern Munich",        rating:87, attack:87, midfield:88, defense:46, positions:["CAM","LW"],     face:"faces/musiala.png",     rarity:"gold"    },
  { name:"Dominik Szoboszlai",    nation:"Hungary",     club:"Liverpool",          rating:87, attack:84, midfield:88, defense:75, positions:["CAM","RW", "CM", "RB"],     face:"faces/szob.png",     rarity:"gold"    },

  // ── LEFT WING ─────────────────────────────────────────────
  { name:"Vinicius Jr",           nation:"Brazil",      club:"Real Madrid",        rating:89, attack:91, midfield:85, defense:40, positions:["LW"],           face:"faces/vini.png",     rarity:"gold" },
  { name:"Kylian Mbappé",         nation:"France",      club:"Real Madrid",        rating:91, attack:93, midfield:86, defense:38, positions:["LW","ST"],      face:"faces/mbappe.png",       rarity:"gold" },
  { name:"Raphinha",              nation:"Brazil",      club:"Barcelona",        rating:89, attack:90, midfield:86, defense:52, positions:["LW","RW"],      face:"faces/raphinha.png",       rarity:"gold" },
  { name:"Leroy Sané",            nation:"Germany",     club:"Bayern Munich",      rating:86, attack:86, midfield:72, defense:38, positions:["LW","RW"],      face:"faces/sane.png",         rarity:"gold"    },
  { name:"Luis Diaz",            nation:"Colombia",     club:"Bayern Munich",      rating:88, attack:89, midfield:84, defense:48, positions:["LW"],      face:"faces/diaz.png",         rarity:"gold"    },
  { name:"Kvicha Kvaratskhelia",       nation:"Georgia",      club:"PSG",          rating:89, attack:90, midfield:87, defense:44, positions:["LW", "RW"],      face:"faces/kvara.png",      rarity:"gold"    },
  { name:"Ousmane Dembélé",       nation:"France",      club:"PSG",                rating:90, attack:91, midfield:86, defense:42, positions:["ST","RW"],      face:"faces/dembele.png",      rarity:"gold"    },
  { name:"Rafael Leão",           nation:"Portugal",    club:"AC Milan",           rating:86, attack:88, midfield:66, defense:30, positions:["LW","ST"],      face:"faces/leao.png",         rarity:"gold"    },

  // ── RIGHT WING ────────────────────────────────────────────
  { name:"Mohamed Salah",         nation:"Egypt",       club:"Liverpool",          rating:87, attack:88, midfield:84, defense:44, positions:["RW"],      face:"faces/salah.png",        rarity:"gold"    },
  { name:"Phil Foden",            nation:"England",     club:"Man City",           rating:90, attack:89, midfield:84, defense:44, positions:["RW","LW","CAM"],face:"faces/foden.png",        rarity:"gold"    },
  { name:"Florian Wirtz",         nation:"Germany",     club:"Bayer Leverkusen",   rating:89, attack:88, midfield:86, defense:42, positions:["RW","CAM"],     face:"faces/wirtz.png",        rarity:"gold" },
  { name:"Rodrygo",               nation:"Brazil",      club:"Real Madrid",        rating:85, attack:85, midfield:72, defense:36, positions:["RW","LW"],      face:"faces/rodrygo.png",      rarity:"gold"    },
  { name:"Lamine Yamal",          nation:"Spain",      club:"Barcelona",         rating:91, attack:91, midfield:90, defense:41, positions:["RW"],      face:"faces/yamal.png",      rarity:"gold"    },
  { name:"Michael Olise",          nation:"France",      club:"Bayern Munich",        rating:89, attack:89, midfield:88, defense:46, positions:["RW"],      face:"faces/olise.png",      rarity:"gold"    },
  { name:"Désiré Doué",          nation:"France",      club:"PSG",               rating:86, attack:87, midfield:85, defense:50, positions:["RW"],      face:"faces/doue.png",      rarity:"gold"    },
  { name:"Bukayo Saka",       nation:"England",       club:"Arsenal",          rating:87, attack:88, midfield:86, defense:58, positions:["RW"],      face:"faces/saka.png",       rarity:"gold"  },
  { name:"Lionel Messi",       nation:"Argentina",       club:"Inter Miami",          rating:86, attack:87, midfield:88, defense:29, positions:["RW","CAM"],      face:"faces/messi.png",       rarity:"gold"  },


  // ── STRIKERS ──────────────────────────────────────────────
  { name:"Erling Haaland",        nation:"Norway",      club:"Man City",           rating:90, attack:93, midfield:78, defense:45, positions:["ST"],           face:"faces/haaland.png",      rarity:"gold" },
  { name:"Harry Kane",            nation:"England",     club:"Bayern Munich",      rating:91, attack:94, midfield:86, defense:49, positions:["ST"],           face:"faces/kane.png",         rarity:"gold"    },
  { name:"Robert Lewandowski",    nation:"Poland",      club:"Barcelona",          rating:86, attack:89, midfield:80, defense:42, positions:["ST"],           face:"faces/lewandowski.png",  rarity:"gold"    },
  { name:"Victor Osimhen",        nation:"Nigeria",     club:"Galatasaray",        rating:88, attack:89, midfield:60, defense:24, positions:["ST"],           face:"faces/osimhen.png",      rarity:"gold"    },
  { name:"Lautaro Martínez",      nation:"Argentina",   club:"Inter Milan",        rating:87, attack:89, midfield:82, defense:52, positions:["ST"],           face:"faces/lautaro.png",      rarity:"gold"    },
  { name:"Darwin Núñez",          nation:"Uruguay",     club:"Liverpool",          rating:84, attack:85, midfield:58, defense:25, positions:["ST","LW"],      face:"faces/nunez.png",        rarity:"gold"    },
  { name:"Julian Alvarez",        nation:"Argentina",      club:"Atletico Madrid",     rating:87, attack:89, midfield:84, defense:56, positions:["ST"],           face:"faces/alvarez.png",       rarity:"gold"  },

];
