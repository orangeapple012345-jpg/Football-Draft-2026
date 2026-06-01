// ============================================================
//  FOOTBALL DRAFT — PLAYER DATABASE
//
//  playerGroup: players sharing the same group are treated as
//  the same person. Once any version is drafted, all other
//  versions of that player are blocked from the pool.
//
//  Example: "thibaut-courtois" blocks all Courtois versions
//  once one is picked — regardless of season.
//
//  POSITIONS: GK, LB, CB, RB, CDM, CM, CAM, LW, RW, ST
//  RARITY:    "gold" | "silver" | "bronze" | "special"
// ============================================================

const PLAYERS = [

  // ══════════════════════════════════════════════════════════
  //  GOALKEEPERS
  // ══════════════════════════════════════════════════════════

  // ── THIBAUT COURTOIS ──────────────────────────────────────
  {
    name: "Thibaut Courtois — 18/19",
    playerGroup: "thibaut-courtois",
    nation: "Belgium", club: "Real Madrid",
    position: "GK", secondaryPositions: [],
    overall: 91, attack: 10, midfield: 15, defense: 91,
    pace: 42, physical: 82, technical: 60, intelligence: 88,
    workRate: 68, creativity: 20, finishing: 5, passing: 70,
    dribbling: 25, pressing: 15, aerial: 88, stamina: 72,
    defensiveAwareness: 90, tackling: 20, positioning: 91,
    transitionThreat: 8, pressResistance: 75, bigGameRating: 92,
    consistency: 88, leadership: 82, versatility: 20, weakFoot: 50,
    setPieces: 30, crossing: 10,
    goalkeeperRating: 91, reflexes: 92, commandOfArea: 88, distribution: 78,
    traits: ["shotStopper", "bigGamePlayer", "aerialCommander"],
    playstyles: ["lowBlock", "organised"],
    positions: ["GK"], face: "faces/courtois.png", rarity: "special"
  },
  {
    name: "Thibaut Courtois — 14/15",
    playerGroup: "thibaut-courtois",
    nation: "Belgium", club: "Chelsea",
    position: "GK", secondaryPositions: [],
    overall: 87, attack: 8, midfield: 12, defense: 87,
    pace: 40, physical: 80, technical: 55, intelligence: 84,
    workRate: 65, creativity: 15, finishing: 5, passing: 65,
    dribbling: 20, pressing: 12, aerial: 84, stamina: 70,
    defensiveAwareness: 86, tackling: 18, positioning: 86,
    transitionThreat: 6, pressResistance: 70, bigGameRating: 84,
    consistency: 82, leadership: 74, versatility: 18, weakFoot: 48,
    setPieces: 25, crossing: 8,
    goalkeeperRating: 87, reflexes: 88, commandOfArea: 84, distribution: 72,
    traits: ["shotStopper", "aerialCommander"],
    playstyles: ["lowBlock", "organised"],
    positions: ["GK"], face: "faces/courtois.png", rarity: "gold"
  },

  // ── ALISSON BECKER ────────────────────────────────────────
  {
    name: "Alisson Becker — 18/19",
    playerGroup: "alisson-becker",
    nation: "Brazil", club: "Liverpool",
    position: "GK", secondaryPositions: [],
    overall: 90, attack: 8, midfield: 12, defense: 90,
    pace: 40, physical: 80, technical: 65, intelligence: 90,
    workRate: 70, creativity: 18, finishing: 5, passing: 82,
    dribbling: 22, pressing: 12, aerial: 85, stamina: 70,
    defensiveAwareness: 89, tackling: 18, positioning: 90,
    transitionThreat: 10, pressResistance: 80, bigGameRating: 90,
    consistency: 89, leadership: 85, versatility: 20, weakFoot: 55,
    setPieces: 28, crossing: 8,
    goalkeeperRating: 90, reflexes: 89, commandOfArea: 87, distribution: 88,
    traits: ["sweepingKeeper", "distributionExpert", "calmUnderPressure"],
    playstyles: ["highPress", "possession"],
    positions: ["GK"], face: "faces/alisson.png", rarity: "gold"
  },
  {
    name: "Alisson Becker — 16/17",
    playerGroup: "alisson-becker",
    nation: "Brazil", club: "Roma",
    position: "GK", secondaryPositions: [],
    overall: 84, attack: 7, midfield: 10, defense: 84,
    pace: 38, physical: 76, technical: 60, intelligence: 84,
    workRate: 66, creativity: 14, finishing: 5, passing: 76,
    dribbling: 18, pressing: 10, aerial: 80, stamina: 68,
    defensiveAwareness: 83, tackling: 16, positioning: 84,
    transitionThreat: 8, pressResistance: 74, bigGameRating: 80,
    consistency: 80, leadership: 74, versatility: 18, weakFoot: 52,
    setPieces: 22, crossing: 7,
    goalkeeperRating: 84, reflexes: 84, commandOfArea: 82, distribution: 82,
    traits: ["sweepingKeeper", "calmUnderPressure"],
    playstyles: ["possession"],
    positions: ["GK"], face: "faces/alisson.png", rarity: "silver"
  },

  // ── MANUEL NEUER ──────────────────────────────────────────
  {
    name: "Manuel Neuer — 14/15",
    playerGroup: "manuel-neuer",
    nation: "Germany", club: "Bayern Munich",
    position: "GK", secondaryPositions: [],
    overall: 93, attack: 12, midfield: 16, defense: 93,
    pace: 55, physical: 84, technical: 74, intelligence: 94,
    workRate: 74, creativity: 22, finishing: 6, passing: 82,
    dribbling: 38, pressing: 20, aerial: 88, stamina: 74,
    defensiveAwareness: 92, tackling: 28, positioning: 92,
    transitionThreat: 18, pressResistance: 86, bigGameRating: 94,
    consistency: 92, leadership: 92, versatility: 38, weakFoot: 60,
    setPieces: 32, crossing: 12,
    goalkeeperRating: 93, reflexes: 91, commandOfArea: 96, distribution: 88,
    traits: ["sweepingKeeper", "leader", "aerialCommander", "bigGamePlayer"],
    playstyles: ["highPress", "organised"],
    positions: ["GK"], face: "faces/neuer.png", rarity: "special"
  },
  {
    name: "Manuel Neuer — 22/23",
    playerGroup: "manuel-neuer",
    nation: "Germany", club: "Bayern Munich",
    position: "GK", secondaryPositions: [],
    overall: 86, attack: 9, midfield: 13, defense: 86,
    pace: 44, physical: 78, technical: 66, intelligence: 90,
    workRate: 68, creativity: 18, finishing: 5, passing: 78,
    dribbling: 30, pressing: 16, aerial: 82, stamina: 68,
    defensiveAwareness: 88, tackling: 22, positioning: 86,
    transitionThreat: 12, pressResistance: 80, bigGameRating: 84,
    consistency: 80, leadership: 88, versatility: 30, weakFoot: 56,
    setPieces: 28, crossing: 9,
    goalkeeperRating: 86, reflexes: 83, commandOfArea: 90, distribution: 82,
    traits: ["sweepingKeeper", "leader"],
    playstyles: ["highPress", "organised"],
    positions: ["GK"], face: "faces/neuer.png", rarity: "gold"
  },

  // ── EDERSON ───────────────────────────────────────────────
  {
    name: "Ederson — 18/19",
    playerGroup: "ederson",
    nation: "Brazil", club: "Man City",
    position: "GK", secondaryPositions: [],
    overall: 88, attack: 11, midfield: 15, defense: 88,
    pace: 45, physical: 80, technical: 68, intelligence: 86,
    workRate: 68, creativity: 18, finishing: 5, passing: 86,
    dribbling: 30, pressing: 14, aerial: 82, stamina: 70,
    defensiveAwareness: 87, tackling: 22, positioning: 86,
    transitionThreat: 12, pressResistance: 84, bigGameRating: 85,
    consistency: 86, leadership: 80, versatility: 25, weakFoot: 60,
    setPieces: 25, crossing: 10,
    goalkeeperRating: 88, reflexes: 86, commandOfArea: 85, distribution: 92,
    traits: ["distributionExpert", "sweepingKeeper", "calmUnderPressure"],
    playstyles: ["possession", "highPress"],
    positions: ["GK"], face: "faces/ederson.png", rarity: "gold"
  },

  // ── PETER SCHMEICHEL ──────────────────────────────────────
  {
    name: "Peter Schmeichel — 98/99",
    playerGroup: "peter-schmeichel",
    nation: "Denmark", club: "Man United",
    position: "GK", secondaryPositions: [],
    overall: 94, attack: 14, midfield: 10, defense: 94,
    pace: 44, physical: 88, technical: 68, intelligence: 90,
    workRate: 72, creativity: 14, finishing: 6, passing: 64,
    dribbling: 20, pressing: 16, aerial: 90, stamina: 74,
    defensiveAwareness: 92, tackling: 24, positioning: 90,
    transitionThreat: 10, pressResistance: 78, bigGameRating: 96,
    consistency: 88, leadership: 96, versatility: 18, weakFoot: 54,
    setPieces: 28, crossing: 10,
    goalkeeperRating: 94, reflexes: 92, commandOfArea: 96, distribution: 72,
    traits: ["aerialCommander", "leader", "bigGamePlayer", "shotStopper"],
    playstyles: ["organised", "direct"],
    positions: ["GK"], face: "faces/default.png", rarity: "special"
  },

  // ── GIANLUIGI BUFFON ──────────────────────────────────────
  {
    name: "Gianluigi Buffon — 02/03",
    playerGroup: "buffon",
    nation: "Italy", club: "Juventus",
    position: "GK", secondaryPositions: [],
    overall: 95, attack: 9, midfield: 12, defense: 95,
    pace: 38, physical: 86, technical: 72, intelligence: 94,
    workRate: 70, creativity: 12, finishing: 5, passing: 66,
    dribbling: 18, pressing: 14, aerial: 88, stamina: 72,
    defensiveAwareness: 94, tackling: 22, positioning: 94,
    transitionThreat: 8, pressResistance: 82, bigGameRating: 96,
    consistency: 92, leadership: 94, versatility: 16, weakFoot: 54,
    setPieces: 26, crossing: 9,
    goalkeeperRating: 95, reflexes: 94, commandOfArea: 92, distribution: 70,
    traits: ["shotStopper", "leader", "bigGamePlayer", "aerialCommander"],
    playstyles: ["organised", "lowBlock"],
    positions: ["GK"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Gianluigi Buffon — 14/15",
    playerGroup: "buffon",
    nation: "Italy", club: "Juventus",
    position: "GK", secondaryPositions: [],
    overall: 89, attack: 8, midfield: 10, defense: 89,
    pace: 34, physical: 80, technical: 68, intelligence: 92,
    workRate: 68, creativity: 10, finishing: 5, passing: 62,
    dribbling: 15, pressing: 12, aerial: 84, stamina: 68,
    defensiveAwareness: 90, tackling: 20, positioning: 90,
    transitionThreat: 6, pressResistance: 80, bigGameRating: 92,
    consistency: 88, leadership: 92, versatility: 14, weakFoot: 52,
    setPieces: 24, crossing: 8,
    goalkeeperRating: 89, reflexes: 88, commandOfArea: 90, distribution: 66,
    traits: ["shotStopper", "leader", "bigGamePlayer"],
    playstyles: ["organised", "lowBlock"],
    positions: ["GK"], face: "faces/default.png", rarity: "gold"
  },

  // ══════════════════════════════════════════════════════════
  //  RIGHT BACKS
  // ══════════════════════════════════════════════════════════

  // ── TRENT ALEXANDER-ARNOLD ────────────────────────────────
  {
    name: "Trent Alexander-Arnold — 21/22",
    playerGroup: "trent-alexander-arnold",
    nation: "England", club: "Liverpool",
    position: "RB", secondaryPositions: ["CM"],
    overall: 87, attack: 80, midfield: 78, defense: 72,
    pace: 78, physical: 70, technical: 86, intelligence: 84,
    workRate: 78, creativity: 88, finishing: 58, passing: 92,
    dribbling: 75, pressing: 65, aerial: 62, stamina: 78,
    defensiveAwareness: 68, tackling: 68, positioning: 76,
    transitionThreat: 78, pressResistance: 80, bigGameRating: 84,
    consistency: 80, leadership: 70, versatility: 82, weakFoot: 70,
    setPieces: 90, crossing: 94,
    traits: ["crossingSpecialist", "setPieceExpert", "attackingFullback", "visionPasser"],
    playstyles: ["possession", "wide", "highPress"],
    positions: ["RB"], face: "faces/trent.png", rarity: "gold"
  },
  {
    name: "Trent Alexander-Arnold — 18/19",
    playerGroup: "trent-alexander-arnold",
    nation: "England", club: "Liverpool",
    position: "RB", secondaryPositions: [],
    overall: 80, attack: 72, midfield: 70, defense: 68,
    pace: 76, physical: 66, technical: 80, intelligence: 76,
    workRate: 74, creativity: 78, finishing: 50, passing: 84,
    dribbling: 68, pressing: 60, aerial: 58, stamina: 74,
    defensiveAwareness: 62, tackling: 62, positioning: 70,
    transitionThreat: 70, pressResistance: 72, bigGameRating: 76,
    consistency: 72, leadership: 60, versatility: 70, weakFoot: 64,
    setPieces: 84, crossing: 88,
    traits: ["crossingSpecialist", "setPieceExpert", "attackingFullback"],
    playstyles: ["possession", "wide"],
    positions: ["RB"], face: "faces/trent.png", rarity: "silver"
  },

  // ── ACHRAF HAKIMI ─────────────────────────────────────────
  {
    name: "Achraf Hakimi — 21/22",
    playerGroup: "achraf-hakimi",
    nation: "Morocco", club: "PSG",
    position: "RB", secondaryPositions: ["RW"],
    overall: 86, attack: 82, midfield: 72, defense: 78,
    pace: 95, physical: 76, technical: 80, intelligence: 78,
    workRate: 85, creativity: 74, finishing: 65, passing: 78,
    dribbling: 84, pressing: 72, aerial: 65, stamina: 88,
    defensiveAwareness: 74, tackling: 76, positioning: 78,
    transitionThreat: 92, pressResistance: 74, bigGameRating: 82,
    consistency: 80, leadership: 68, versatility: 80, weakFoot: 72,
    setPieces: 62, crossing: 80,
    traits: ["paceAbuser", "attackingFullback", "overlappingRunner", "transitionThreat"],
    playstyles: ["counterAttack", "wide", "direct"],
    positions: ["RB"], face: "faces/hakimi.png", rarity: "gold"
  },
  {
    name: "Achraf Hakimi — 19/20",
    playerGroup: "achraf-hakimi",
    nation: "Morocco", club: "Borussia Dortmund",
    position: "RB", secondaryPositions: ["RW"],
    overall: 82, attack: 78, midfield: 66, defense: 72,
    pace: 94, physical: 72, technical: 76, intelligence: 72,
    workRate: 82, creativity: 68, finishing: 60, passing: 72,
    dribbling: 80, pressing: 68, aerial: 60, stamina: 84,
    defensiveAwareness: 68, tackling: 70, positioning: 72,
    transitionThreat: 90, pressResistance: 68, bigGameRating: 76,
    consistency: 74, leadership: 60, versatility: 74, weakFoot: 68,
    setPieces: 56, crossing: 74,
    traits: ["paceAbuser", "attackingFullback", "transitionThreat"],
    playstyles: ["counterAttack", "wide", "direct"],
    positions: ["RB"], face: "faces/hakimi.png", rarity: "silver"
  },

  // ── DANI ALVES ────────────────────────────────────────────
  {
    name: "Dani Alves — 10/11",
    playerGroup: "dani-alves",
    nation: "Brazil", club: "Barcelona",
    position: "RB", secondaryPositions: ["RW"],
    overall: 90, attack: 84, midfield: 76, defense: 82,
    pace: 88, physical: 78, technical: 84, intelligence: 86,
    workRate: 92, creativity: 82, finishing: 66, passing: 84,
    dribbling: 86, pressing: 80, aerial: 68, stamina: 92,
    defensiveAwareness: 80, tackling: 80, positioning: 80,
    transitionThreat: 88, pressResistance: 80, bigGameRating: 90,
    consistency: 86, leadership: 80, versatility: 84, weakFoot: 76,
    setPieces: 70, crossing: 88,
    traits: ["attackingFullback", "crossingSpecialist", "overlappingRunner", "highWorkRate", "bigGamePlayer"],
    playstyles: ["possession", "wide", "highPress"],
    positions: ["RB"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Dani Alves — 15/16",
    playerGroup: "dani-alves",
    nation: "Brazil", club: "Juventus",
    position: "RB", secondaryPositions: ["RW"],
    overall: 85, attack: 78, midfield: 70, defense: 78,
    pace: 82, physical: 74, technical: 80, intelligence: 84,
    workRate: 88, creativity: 76, finishing: 60, passing: 80,
    dribbling: 80, pressing: 74, aerial: 64, stamina: 86,
    defensiveAwareness: 76, tackling: 76, positioning: 76,
    transitionThreat: 80, pressResistance: 76, bigGameRating: 84,
    consistency: 80, leadership: 76, versatility: 80, weakFoot: 72,
    setPieces: 64, crossing: 82,
    traits: ["attackingFullback", "crossingSpecialist", "overlappingRunner"],
    playstyles: ["possession", "wide"],
    positions: ["RB"], face: "faces/default.png", rarity: "gold"
  },

  // ── KYLE WALKER ───────────────────────────────────────────
  {
    name: "Kyle Walker — 17/18",
    playerGroup: "kyle-walker",
    nation: "England", club: "Man City",
    position: "RB", secondaryPositions: [],
    overall: 84, attack: 70, midfield: 66, defense: 84,
    pace: 97, physical: 84, technical: 72, intelligence: 80,
    workRate: 86, creativity: 58, finishing: 46, passing: 72,
    dribbling: 70, pressing: 74, aerial: 72, stamina: 88,
    defensiveAwareness: 82, tackling: 80, positioning: 82,
    transitionThreat: 82, pressResistance: 74, bigGameRating: 80,
    consistency: 80, leadership: 70, versatility: 68, weakFoot: 64,
    setPieces: 44, crossing: 68,
    traits: ["elitePace", "recoveryDefender", "disciplinedDefender"],
    playstyles: ["highPress", "counterAttack"],
    positions: ["RB"], face: "faces/walker.png", rarity: "gold"
  },

  // ── CAFU ──────────────────────────────────────────────────
  {
    name: "Cafu — 01/02",
    playerGroup: "cafu",
    nation: "Brazil", club: "AS Roma",
    position: "RB", secondaryPositions: [],
    overall: 92, attack: 82, midfield: 72, defense: 86,
    pace: 90, physical: 84, technical: 80, intelligence: 86,
    workRate: 94, creativity: 72, finishing: 62, passing: 78,
    dribbling: 78, pressing: 80, aerial: 72, stamina: 96,
    defensiveAwareness: 86, tackling: 84, positioning: 86,
    transitionThreat: 86, pressResistance: 78, bigGameRating: 90,
    consistency: 90, leadership: 86, versatility: 76, weakFoot: 70,
    setPieces: 64, crossing: 84,
    traits: ["attackingFullback", "overlappingRunner", "highWorkRate", "consistentPerformer"],
    playstyles: ["counterAttack", "wide", "direct"],
    positions: ["RB"], face: "faces/default.png", rarity: "special"
  },

  // ══════════════════════════════════════════════════════════
  //  LEFT BACKS
  // ══════════════════════════════════════════════════════════

  // ── ALPHONSO DAVIES ───────────────────────────────────────
  {
    name: "Alphonso Davies — 19/20",
    playerGroup: "alphonso-davies",
    nation: "Canada", club: "Bayern Munich",
    position: "LB", secondaryPositions: ["LW"],
    overall: 86, attack: 79, midfield: 72, defense: 78,
    pace: 97, physical: 74, technical: 78, intelligence: 76,
    workRate: 88, creativity: 72, finishing: 58, passing: 74,
    dribbling: 84, pressing: 78, aerial: 62, stamina: 90,
    defensiveAwareness: 72, tackling: 74, positioning: 74,
    transitionThreat: 94, pressResistance: 72, bigGameRating: 80,
    consistency: 78, leadership: 65, versatility: 80, weakFoot: 72,
    setPieces: 52, crossing: 76,
    traits: ["elitePace", "attackingFullback", "transitionThreat", "overlappingRunner"],
    playstyles: ["highPress", "counterAttack", "wide"],
    positions: ["LB"], face: "faces/davies.png", rarity: "gold"
  },

  // ── ANDREW ROBERTSON ──────────────────────────────────────
  {
    name: "Andrew Robertson — 18/19",
    playerGroup: "andrew-robertson",
    nation: "Scotland", club: "Liverpool",
    position: "LB", secondaryPositions: [],
    overall: 87, attack: 74, midfield: 76, defense: 84,
    pace: 82, physical: 78, technical: 78, intelligence: 84,
    workRate: 96, creativity: 72, finishing: 52, passing: 82,
    dribbling: 74, pressing: 90, aerial: 70, stamina: 96,
    defensiveAwareness: 82, tackling: 82, positioning: 82,
    transitionThreat: 76, pressResistance: 78, bigGameRating: 84,
    consistency: 86, leadership: 82, versatility: 70, weakFoot: 70,
    setPieces: 58, crossing: 84,
    traits: ["highEnergyRunner", "crossingSpecialist", "pressMonster", "consistentPerformer"],
    playstyles: ["highPress", "wide"],
    positions: ["LB"], face: "faces/robertson.png", rarity: "gold"
  },
  {
    name: "Andrew Robertson — 16/17",
    playerGroup: "andrew-robertson",
    nation: "Scotland", club: "Hull City",
    position: "LB", secondaryPositions: [],
    overall: 76, attack: 64, midfield: 66, defense: 74,
    pace: 78, physical: 72, technical: 68, intelligence: 74,
    workRate: 90, creativity: 60, finishing: 42, passing: 70,
    dribbling: 64, pressing: 78, aerial: 62, stamina: 90,
    defensiveAwareness: 72, tackling: 72, positioning: 72,
    transitionThreat: 62, pressResistance: 66, bigGameRating: 66,
    consistency: 72, leadership: 62, versatility: 60, weakFoot: 62,
    setPieces: 46, crossing: 72,
    traits: ["highEnergyRunner", "pressMonster"],
    playstyles: ["highPress", "wide"],
    positions: ["LB"], face: "faces/robertson.png", rarity: "bronze"
  },

  // ── ROBERTO CARLOS ────────────────────────────────────────
  {
    name: "Roberto Carlos — 01/02",
    playerGroup: "roberto-carlos",
    nation: "Brazil", club: "Real Madrid",
    position: "LB", secondaryPositions: ["LW"],
    overall: 93, attack: 86, midfield: 74, defense: 84,
    pace: 92, physical: 84, technical: 84, intelligence: 82,
    workRate: 90, creativity: 80, finishing: 70, passing: 80,
    dribbling: 82, pressing: 76, aerial: 68, stamina: 92,
    defensiveAwareness: 80, tackling: 82, positioning: 78,
    transitionThreat: 92, pressResistance: 78, bigGameRating: 92,
    consistency: 86, leadership: 82, versatility: 80, weakFoot: 80,
    setPieces: 88, crossing: 84,
    traits: ["attackingFullback", "elitePace", "setPieceExpert", "crossingSpecialist", "overlappingRunner"],
    playstyles: ["counterAttack", "wide", "direct"],
    positions: ["LB"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Roberto Carlos — 97/98",
    playerGroup: "roberto-carlos",
    nation: "Brazil", club: "Real Madrid",
    position: "LB", secondaryPositions: ["LW"],
    overall: 91, attack: 84, midfield: 72, defense: 82,
    pace: 94, physical: 82, technical: 82, intelligence: 80,
    workRate: 90, creativity: 78, finishing: 68, passing: 78,
    dribbling: 80, pressing: 74, aerial: 66, stamina: 92,
    defensiveAwareness: 78, tackling: 80, positioning: 76,
    transitionThreat: 92, pressResistance: 76, bigGameRating: 90,
    consistency: 84, leadership: 80, versatility: 78, weakFoot: 80,
    setPieces: 90, crossing: 82,
    traits: ["attackingFullback", "elitePace", "setPieceExpert", "crossingSpecialist"],
    playstyles: ["counterAttack", "wide"],
    positions: ["LB"], face: "faces/default.png", rarity: "special"
  },

  // ── THEO HERNANDEZ ────────────────────────────────────────
  {
    name: "Theo Hernandez — 21/22",
    playerGroup: "theo-hernandez",
    nation: "France", club: "AC Milan",
    position: "LB", secondaryPositions: ["LW"],
    overall: 85, attack: 80, midfield: 70, defense: 78,
    pace: 90, physical: 82, technical: 76, intelligence: 74,
    workRate: 82, creativity: 72, finishing: 62, passing: 74,
    dribbling: 80, pressing: 70, aerial: 72, stamina: 84,
    defensiveAwareness: 72, tackling: 76, positioning: 74,
    transitionThreat: 88, pressResistance: 72, bigGameRating: 80,
    consistency: 78, leadership: 68, versatility: 78, weakFoot: 70,
    setPieces: 54, crossing: 78,
    traits: ["paceAbuser", "attackingFullback", "transitionThreat"],
    playstyles: ["counterAttack", "direct", "wide"],
    positions: ["LB"], face: "faces/theohernandez.png", rarity: "gold"
  },

  // ══════════════════════════════════════════════════════════
  //  CENTRE BACKS
  // ══════════════════════════════════════════════════════════

  // ── VIRGIL VAN DIJK ───────────────────────────────────────
  {
    name: "Virgil van Dijk — 18/19",
    playerGroup: "virgil-van-dijk",
    nation: "Netherlands", club: "Liverpool",
    position: "CB", secondaryPositions: [],
    overall: 90, attack: 40, midfield: 52, defense: 90,
    pace: 76, physical: 90, technical: 72, intelligence: 90,
    workRate: 74, creativity: 44, finishing: 48, passing: 82,
    dribbling: 54, pressing: 68, aerial: 94, stamina: 78,
    defensiveAwareness: 90, tackling: 88, positioning: 90,
    transitionThreat: 38, pressResistance: 84, bigGameRating: 90,
    consistency: 88, leadership: 92, versatility: 44, weakFoot: 76,
    setPieces: 72, crossing: 44,
    traits: ["aerialDominator", "leader", "organiser", "setPieceThreat"],
    playstyles: ["highPress", "organised", "possession"],
    positions: ["CB"], face: "faces/vandijk.png", rarity: "special"
  },
  {
    name: "Virgil van Dijk — 16/17",
    playerGroup: "virgil-van-dijk",
    nation: "Netherlands", club: "Southampton",
    position: "CB", secondaryPositions: [],
    overall: 83, attack: 34, midfield: 44, defense: 83,
    pace: 74, physical: 86, technical: 66, intelligence: 82,
    workRate: 70, creativity: 38, finishing: 42, passing: 74,
    dribbling: 48, pressing: 60, aerial: 88, stamina: 74,
    defensiveAwareness: 82, tackling: 82, positioning: 82,
    transitionThreat: 32, pressResistance: 76, bigGameRating: 78,
    consistency: 78, leadership: 80, versatility: 38, weakFoot: 70,
    setPieces: 64, crossing: 38,
    traits: ["aerialDominator", "leader"],
    playstyles: ["organised"],
    positions: ["CB"], face: "faces/vandijk.png", rarity: "gold"
  },

  // ── BOBBY MOORE ───────────────────────────────────────────
  {
    name: "Bobby Moore — 65/66",
    playerGroup: "bobby-moore",
    nation: "England", club: "West Ham",
    position: "CB", secondaryPositions: [],
    overall: 91, attack: 44, midfield: 58, defense: 91,
    pace: 66, physical: 78, technical: 80, intelligence: 98,
    workRate: 76, creativity: 54, finishing: 40, passing: 84,
    dribbling: 62, pressing: 70, aerial: 80, stamina: 80,
    defensiveAwareness: 98, tackling: 88, positioning: 96,
    transitionThreat: 30, pressResistance: 90, bigGameRating: 96,
    consistency: 90, leadership: 96, versatility: 52, weakFoot: 80,
    setPieces: 66, crossing: 46,
    traits: ["intelligentPositioner", "leader", "organiser", "bigGamePlayer", "consistentPerformer"],
    playstyles: ["organised", "possession"],
    positions: ["CB"], face: "faces/default.png", rarity: "special"
  },

  // ── RÚBEN DIAS ────────────────────────────────────────────
  {
    name: "Rúben Dias — 20/21",
    playerGroup: "ruben-dias",
    nation: "Portugal", club: "Man City",
    position: "CB", secondaryPositions: [],
    overall: 89, attack: 35, midfield: 50, defense: 89,
    pace: 74, physical: 86, technical: 74, intelligence: 92,
    workRate: 78, creativity: 40, finishing: 38, passing: 80,
    dribbling: 50, pressing: 70, aerial: 86, stamina: 78,
    defensiveAwareness: 92, tackling: 86, positioning: 90,
    transitionThreat: 30, pressResistance: 82, bigGameRating: 88,
    consistency: 90, leadership: 88, versatility: 42, weakFoot: 74,
    setPieces: 66, crossing: 38,
    traits: ["organisedDefender", "leader", "intelligentPositioner", "consistentPerformer"],
    playstyles: ["organised", "possession", "highPress"],
    positions: ["CB"], face: "faces/rubendias.png", rarity: "gold"
  },

  // ── WILLIAM SALIBA ────────────────────────────────────────
  {
    name: "William Saliba — 22/23",
    playerGroup: "william-saliba",
    nation: "France", club: "Arsenal",
    position: "CB", secondaryPositions: [],
    overall: 87, attack: 32, midfield: 46, defense: 87,
    pace: 82, physical: 84, technical: 72, intelligence: 84,
    workRate: 76, creativity: 36, finishing: 32, passing: 78,
    dribbling: 52, pressing: 68, aerial: 82, stamina: 78,
    defensiveAwareness: 86, tackling: 86, positioning: 86,
    transitionThreat: 34, pressResistance: 78, bigGameRating: 84,
    consistency: 84, leadership: 74, versatility: 42, weakFoot: 72,
    setPieces: 60, crossing: 34,
    traits: ["recoveryDefender", "modernCentreback", "aerialDominator"],
    playstyles: ["highPress", "organised"],
    positions: ["CB"], face: "faces/saliba.png", rarity: "gold"
  },

  // ── ANTONIO RÜDIGER ───────────────────────────────────────
  {
    name: "Antonio Rüdiger — 21/22",
    playerGroup: "antonio-rudiger",
    nation: "Germany", club: "Chelsea",
    position: "CB", secondaryPositions: [],
    overall: 87, attack: 38, midfield: 48, defense: 87,
    pace: 84, physical: 92, technical: 66, intelligence: 82,
    workRate: 80, creativity: 36, finishing: 40, passing: 72,
    dribbling: 50, pressing: 72, aerial: 86, stamina: 82,
    defensiveAwareness: 84, tackling: 88, positioning: 82,
    transitionThreat: 44, pressResistance: 76, bigGameRating: 86,
    consistency: 82, leadership: 80, versatility: 46, weakFoot: 70,
    setPieces: 58, crossing: 36,
    traits: ["physicalBeast", "aerialDominator", "aggressiveDefender", "bigGamePlayer"],
    playstyles: ["highPress", "direct"],
    positions: ["CB"], face: "faces/rudiger.png", rarity: "gold"
  },

  // ── FABIO CANNAVARO ───────────────────────────────────────
  {
    name: "Fabio Cannavaro — 05/06",
    playerGroup: "fabio-cannavaro",
    nation: "Italy", club: "Juventus",
    position: "CB", secondaryPositions: [],
    overall: 93, attack: 36, midfield: 52, defense: 93,
    pace: 78, physical: 82, technical: 74, intelligence: 94,
    workRate: 80, creativity: 42, finishing: 38, passing: 76,
    dribbling: 56, pressing: 74, aerial: 84, stamina: 82,
    defensiveAwareness: 94, tackling: 90, positioning: 94,
    transitionThreat: 34, pressResistance: 86, bigGameRating: 94,
    consistency: 90, leadership: 92, versatility: 50, weakFoot: 76,
    setPieces: 62, crossing: 38,
    traits: ["intelligentPositioner", "leader", "consistentPerformer", "aggressiveDefender"],
    playstyles: ["organised", "lowBlock"],
    positions: ["CB"], face: "faces/default.png", rarity: "special"
  },

  // ══════════════════════════════════════════════════════════
  //  CDM
  // ══════════════════════════════════════════════════════════

  // ── RODRI ─────────────────────────────────────────────────
  {
    name: "Rodri — 22/23",
    playerGroup: "rodri",
    nation: "Spain", club: "Man City",
    position: "CDM", secondaryPositions: ["CM"],
    overall: 91, attack: 62, midfield: 91, defense: 86,
    pace: 68, physical: 84, technical: 86, intelligence: 95,
    workRate: 88, creativity: 78, finishing: 60, passing: 90,
    dribbling: 72, pressing: 84, aerial: 80, stamina: 86,
    defensiveAwareness: 90, tackling: 86, positioning: 92,
    transitionThreat: 58, pressResistance: 92, bigGameRating: 90,
    consistency: 92, leadership: 86, versatility: 80, weakFoot: 80,
    setPieces: 70, crossing: 62,
    traits: ["midfielderColossus", "calmUnderPressure", "intelligentPositioner", "consistentPerformer"],
    playstyles: ["possession", "organised", "highPress"],
    positions: ["CDM"], face: "faces/rodri.png", rarity: "special"
  },

  // ── CLAUDE MAKÉLÉLÉ ───────────────────────────────────────
  {
    name: "Claude Makélélé — 03/04",
    playerGroup: "claude-makelele",
    nation: "France", club: "Chelsea",
    position: "CDM", secondaryPositions: [],
    overall: 91, attack: 44, midfield: 86, defense: 90,
    pace: 70, physical: 80, technical: 78, intelligence: 94,
    workRate: 92, creativity: 56, finishing: 38, passing: 80,
    dribbling: 66, pressing: 86, aerial: 68, stamina: 90,
    defensiveAwareness: 96, tackling: 92, positioning: 96,
    transitionThreat: 40, pressResistance: 84, bigGameRating: 88,
    consistency: 90, leadership: 82, versatility: 62, weakFoot: 74,
    setPieces: 54, crossing: 44,
    traits: ["protectiveScreener", "intelligentPositioner", "pressMonster", "hardTackler"],
    playstyles: ["organised", "lowBlock"],
    positions: ["CDM"], face: "faces/default.png", rarity: "special"
  },

  // ── DECLAN RICE ───────────────────────────────────────────
  {
    name: "Declan Rice — 23/24",
    playerGroup: "declan-rice",
    nation: "England", club: "Arsenal",
    position: "CDM", secondaryPositions: ["CM"],
    overall: 86, attack: 64, midfield: 85, defense: 82,
    pace: 72, physical: 84, technical: 78, intelligence: 84,
    workRate: 92, creativity: 66, finishing: 56, passing: 80,
    dribbling: 70, pressing: 88, aerial: 78, stamina: 90,
    defensiveAwareness: 84, tackling: 84, positioning: 84,
    transitionThreat: 62, pressResistance: 80, bigGameRating: 82,
    consistency: 84, leadership: 80, versatility: 74, weakFoot: 74,
    setPieces: 60, crossing: 58,
    traits: ["pressMonster", "boxToBox", "energeticRunner", "disciplinedDefender"],
    playstyles: ["highPress", "organised"],
    positions: ["CDM"], face: "faces/declanrice.png", rarity: "gold"
  },
  {
    name: "Declan Rice — 20/21",
    playerGroup: "declan-rice",
    nation: "England", club: "West Ham",
    position: "CDM", secondaryPositions: [],
    overall: 80, attack: 56, midfield: 78, defense: 78,
    pace: 70, physical: 80, technical: 70, intelligence: 78,
    workRate: 88, creativity: 56, finishing: 48, passing: 72,
    dribbling: 62, pressing: 80, aerial: 74, stamina: 86,
    defensiveAwareness: 78, tackling: 78, positioning: 78,
    transitionThreat: 52, pressResistance: 72, bigGameRating: 72,
    consistency: 76, leadership: 70, versatility: 62, weakFoot: 68,
    setPieces: 52, crossing: 50,
    traits: ["pressMonster", "disciplinedDefender"],
    playstyles: ["organised"],
    positions: ["CDM"], face: "faces/declanrice.png", rarity: "silver"
  },

  // ── CASEMIRO ──────────────────────────────────────────────
  {
    name: "Casemiro — 19/20",
    playerGroup: "casemiro",
    nation: "Brazil", club: "Real Madrid",
    position: "CDM", secondaryPositions: [],
    overall: 88, attack: 58, midfield: 86, defense: 86,
    pace: 64, physical: 90, technical: 76, intelligence: 88,
    workRate: 88, creativity: 64, finishing: 60, passing: 78,
    dribbling: 66, pressing: 84, aerial: 86, stamina: 86,
    defensiveAwareness: 90, tackling: 92, positioning: 88,
    transitionThreat: 52, pressResistance: 84, bigGameRating: 88,
    consistency: 86, leadership: 84, versatility: 68, weakFoot: 76,
    setPieces: 64, crossing: 54,
    traits: ["hardTackler", "aerialDominator", "protectiveScreener", "bigGamePlayer"],
    playstyles: ["organised", "direct", "highPress"],
    positions: ["CDM"], face: "faces/casemiro.png", rarity: "gold"
  },

  // ── SERGIO BUSQUETS ───────────────────────────────────────
  {
    name: "Sergio Busquets — 14/15",
    playerGroup: "sergio-busquets",
    nation: "Spain", club: "Barcelona",
    position: "CDM", secondaryPositions: ["CM"],
    overall: 92, attack: 56, midfield: 90, defense: 86,
    pace: 58, physical: 72, technical: 88, intelligence: 98,
    workRate: 82, creativity: 72, finishing: 44, passing: 90,
    dribbling: 76, pressing: 82, aerial: 68, stamina: 80,
    defensiveAwareness: 94, tackling: 82, positioning: 96,
    transitionThreat: 44, pressResistance: 96, bigGameRating: 90,
    consistency: 90, leadership: 86, versatility: 72, weakFoot: 84,
    setPieces: 66, crossing: 54,
    traits: ["intelligentPositioner", "calmUnderPressure", "metronomeMidfielder", "pressResistant"],
    playstyles: ["possession", "highPress", "organised"],
    positions: ["CDM"], face: "faces/default.png", rarity: "special"
  },

  // ══════════════════════════════════════════════════════════
  //  CM
  // ══════════════════════════════════════════════════════════

  // ── JUDE BELLINGHAM ───────────────────────────────────────
  {
    name: "Jude Bellingham — 23/24",
    playerGroup: "jude-bellingham",
    nation: "England", club: "Real Madrid",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 91, attack: 88, midfield: 89, defense: 70,
    pace: 80, physical: 84, technical: 88, intelligence: 90,
    workRate: 88, creativity: 86, finishing: 84, passing: 86,
    dribbling: 86, pressing: 80, aerial: 80, stamina: 88,
    defensiveAwareness: 68, tackling: 70, positioning: 88,
    transitionThreat: 84, pressResistance: 86, bigGameRating: 94,
    consistency: 88, leadership: 88, versatility: 86, weakFoot: 80,
    setPieces: 72, crossing: 72,
    traits: ["bigGamePlayer", "boxToBox", "goalScoringMidfielder", "leader"],
    playstyles: ["direct", "counterAttack", "possession"],
    positions: ["CM"], face: "faces/bellingham.png", rarity: "special"
  },
  {
    name: "Jude Bellingham — 21/22",
    playerGroup: "jude-bellingham",
    nation: "England", club: "Borussia Dortmund",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 84, attack: 80, midfield: 82, defense: 62,
    pace: 78, physical: 80, technical: 82, intelligence: 82,
    workRate: 84, creativity: 78, finishing: 74, passing: 78,
    dribbling: 80, pressing: 74, aerial: 74, stamina: 84,
    defensiveAwareness: 60, tackling: 64, positioning: 80,
    transitionThreat: 76, pressResistance: 78, bigGameRating: 84,
    consistency: 80, leadership: 78, versatility: 78, weakFoot: 74,
    setPieces: 62, crossing: 62,
    traits: ["bigGamePlayer", "boxToBox", "goalScoringMidfielder"],
    playstyles: ["direct", "counterAttack"],
    positions: ["CM"], face: "faces/bellingham.png", rarity: "gold"
  },

  // ── KEVIN DE BRUYNE ───────────────────────────────────────
  {
    name: "Kevin De Bruyne — 19/20",
    playerGroup: "kevin-de-bruyne",
    nation: "Belgium", club: "Man City",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 91, attack: 86, midfield: 91, defense: 64,
    pace: 74, physical: 76, technical: 92, intelligence: 94,
    workRate: 80, creativity: 96, finishing: 80, passing: 96,
    dribbling: 84, pressing: 68, aerial: 68, stamina: 80,
    defensiveAwareness: 58, tackling: 58, positioning: 86,
    transitionThreat: 80, pressResistance: 86, bigGameRating: 90,
    consistency: 86, leadership: 82, versatility: 80, weakFoot: 82,
    setPieces: 88, crossing: 90,
    traits: ["visionPasser", "chanceCreator", "setPieceExpert", "crossingSpecialist"],
    playstyles: ["possession", "wide", "counterAttack"],
    positions: ["CM"], face: "faces/debruyne.png", rarity: "special"
  },
  {
    name: "Kevin De Bruyne — 15/16",
    playerGroup: "kevin-de-bruyne",
    nation: "Belgium", club: "Man City",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 85, attack: 80, midfield: 85, defense: 58,
    pace: 72, physical: 72, technical: 88, intelligence: 88,
    workRate: 76, creativity: 90, finishing: 72, passing: 90,
    dribbling: 80, pressing: 62, aerial: 62, stamina: 76,
    defensiveAwareness: 52, tackling: 52, positioning: 80,
    transitionThreat: 72, pressResistance: 80, bigGameRating: 82,
    consistency: 78, leadership: 72, versatility: 74, weakFoot: 78,
    setPieces: 82, crossing: 86,
    traits: ["visionPasser", "chanceCreator", "setPieceExpert"],
    playstyles: ["possession", "wide"],
    positions: ["CM"], face: "faces/debruyne.png", rarity: "gold"
  },

  // ── LUKA MODRIC ───────────────────────────────────────────
  {
    name: "Luka Modric — 17/18",
    playerGroup: "luka-modric",
    nation: "Croatia", club: "Real Madrid",
    position: "CM", secondaryPositions: [],
    overall: 91, attack: 76, midfield: 92, defense: 74,
    pace: 70, physical: 68, technical: 94, intelligence: 96,
    workRate: 88, creativity: 90, finishing: 68, passing: 94,
    dribbling: 90, pressing: 80, aerial: 60, stamina: 86,
    defensiveAwareness: 72, tackling: 72, positioning: 86,
    transitionThreat: 70, pressResistance: 94, bigGameRating: 94,
    consistency: 88, leadership: 86, versatility: 78, weakFoot: 88,
    setPieces: 76, crossing: 70,
    traits: ["technicalMaestro", "calmUnderPressure", "bigGamePlayer", "visionPasser"],
    playstyles: ["possession", "organised"],
    positions: ["CM"], face: "faces/modric.png", rarity: "special"
  },
  {
    name: "Luka Modric — 13/14",
    playerGroup: "luka-modric",
    nation: "Croatia", club: "Real Madrid",
    position: "CM", secondaryPositions: [],
    overall: 88, attack: 72, midfield: 88, defense: 70,
    pace: 68, physical: 64, technical: 90, intelligence: 92,
    workRate: 84, creativity: 86, finishing: 62, passing: 90,
    dribbling: 86, pressing: 74, aerial: 56, stamina: 82,
    defensiveAwareness: 68, tackling: 68, positioning: 82,
    transitionThreat: 64, pressResistance: 90, bigGameRating: 88,
    consistency: 84, leadership: 80, versatility: 74, weakFoot: 86,
    setPieces: 72, crossing: 66,
    traits: ["technicalMaestro", "calmUnderPressure", "visionPasser"],
    playstyles: ["possession", "organised"],
    positions: ["CM"], face: "faces/modric.png", rarity: "gold"
  },

  // ── TONI KROOS ────────────────────────────────────────────
  {
    name: "Toni Kroos — 16/17",
    playerGroup: "toni-kroos",
    nation: "Germany", club: "Real Madrid",
    position: "CM", secondaryPositions: [],
    overall: 90, attack: 74, midfield: 92, defense: 72,
    pace: 60, physical: 70, technical: 94, intelligence: 97,
    workRate: 80, creativity: 88, finishing: 64, passing: 97,
    dribbling: 78, pressing: 66, aerial: 62, stamina: 78,
    defensiveAwareness: 70, tackling: 64, positioning: 84,
    transitionThreat: 62, pressResistance: 92, bigGameRating: 92,
    consistency: 90, leadership: 84, versatility: 72, weakFoot: 90,
    setPieces: 90, crossing: 84,
    traits: ["elitePasser", "setPieceExpert", "metronomeMidfielder", "calmUnderPressure"],
    playstyles: ["possession", "organised"],
    positions: ["CM"], face: "faces/kroos.png", rarity: "special"
  },

  // ── PEDRI ─────────────────────────────────────────────────
  {
    name: "Pedri — 21/22",
    playerGroup: "pedri",
    nation: "Spain", club: "Barcelona",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 88, attack: 78, midfield: 88, defense: 62,
    pace: 72, physical: 62, technical: 92, intelligence: 90,
    workRate: 82, creativity: 88, finishing: 66, passing: 88,
    dribbling: 90, pressing: 78, aerial: 52, stamina: 80,
    defensiveAwareness: 60, tackling: 60, positioning: 82,
    transitionThreat: 68, pressResistance: 90, bigGameRating: 82,
    consistency: 82, leadership: 72, versatility: 76, weakFoot: 82,
    setPieces: 68, crossing: 64,
    traits: ["technicalMaestro", "calmUnderPressure", "dribbleMaestro", "pressResistant"],
    playstyles: ["possession", "highPress"],
    positions: ["CM"], face: "faces/pedri.png", rarity: "gold"
  },

  // ── ZINEDINE ZIDANE ───────────────────────────────────────
  {
    name: "Zinedine Zidane — 01/02",
    playerGroup: "zinedine-zidane",
    nation: "France", club: "Real Madrid",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 96, attack: 88, midfield: 96, defense: 62,
    pace: 74, physical: 76, technical: 98, intelligence: 96,
    workRate: 78, creativity: 98, finishing: 82, passing: 94,
    dribbling: 96, pressing: 64, aerial: 70, stamina: 76,
    defensiveAwareness: 58, tackling: 56, positioning: 88,
    transitionThreat: 72, pressResistance: 96, bigGameRating: 98,
    consistency: 88, leadership: 88, versatility: 82, weakFoot: 90,
    setPieces: 82, crossing: 80,
    traits: ["technicalMaestro", "visionPasser", "dribbleMaestro", "bigGamePlayer", "calmUnderPressure"],
    playstyles: ["possession", "direct", "organised"],
    positions: ["CM"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Zinedine Zidane — 97/98",
    playerGroup: "zinedine-zidane",
    nation: "France", club: "Juventus",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 94, attack: 86, midfield: 94, defense: 60,
    pace: 72, physical: 74, technical: 96, intelligence: 94,
    workRate: 76, creativity: 96, finishing: 78, passing: 92,
    dribbling: 94, pressing: 60, aerial: 66, stamina: 74,
    defensiveAwareness: 54, tackling: 52, positioning: 84,
    transitionThreat: 68, pressResistance: 94, bigGameRating: 94,
    consistency: 84, leadership: 84, versatility: 78, weakFoot: 88,
    setPieces: 78, crossing: 76,
    traits: ["technicalMaestro", "visionPasser", "dribbleMaestro", "bigGamePlayer"],
    playstyles: ["possession", "direct"],
    positions: ["CM"], face: "faces/default.png", rarity: "special"
  },

  // ── MARTIN ØDEGAARD ───────────────────────────────────────
  {
    name: "Martin Ødegaard — 23/24",
    playerGroup: "martin-odegaard",
    nation: "Norway", club: "Arsenal",
    position: "CM", secondaryPositions: ["CAM"],
    overall: 88, attack: 82, midfield: 88, defense: 60,
    pace: 74, physical: 66, technical: 90, intelligence: 88,
    workRate: 80, creativity: 90, finishing: 74, passing: 88,
    dribbling: 86, pressing: 74, aerial: 56, stamina: 78,
    defensiveAwareness: 58, tackling: 58, positioning: 82,
    transitionThreat: 72, pressResistance: 84, bigGameRating: 84,
    consistency: 84, leadership: 84, versatility: 78, weakFoot: 80,
    setPieces: 78, crossing: 70,
    traits: ["chanceCreator", "technicalMaestro", "leader", "visionPasser"],
    playstyles: ["possession", "highPress"],
    positions: ["CM"], face: "faces/odegaard.png", rarity: "gold"
  },

  // ══════════════════════════════════════════════════════════
  //  CAM
  // ══════════════════════════════════════════════════════════

  // ── BRUNO FERNANDES ───────────────────────────────────────
  {
    name: "Bruno Fernandes — 21/22",
    playerGroup: "bruno-fernandes",
    nation: "Portugal", club: "Man United",
    position: "CAM", secondaryPositions: ["CM"],
    overall: 87, attack: 84, midfield: 86, defense: 58,
    pace: 72, physical: 70, technical: 86, intelligence: 84,
    workRate: 82, creativity: 88, finishing: 80, passing: 86,
    dribbling: 78, pressing: 72, aerial: 68, stamina: 80,
    defensiveAwareness: 54, tackling: 54, positioning: 82,
    transitionThreat: 74, pressResistance: 80, bigGameRating: 82,
    consistency: 74, leadership: 82, versatility: 76, weakFoot: 76,
    setPieces: 84, crossing: 72,
    traits: ["chanceCreator", "setPieceExpert", "goalScoringMidfielder", "leader"],
    playstyles: ["direct", "possession"],
    positions: ["CAM"], face: "faces/brunofernandes.png", rarity: "gold"
  },

  // ── FLORIAN WIRTZ ─────────────────────────────────────────
  {
    name: "Florian Wirtz — 23/24",
    playerGroup: "florian-wirtz",
    nation: "Germany", club: "Bayer Leverkusen",
    position: "CAM", secondaryPositions: ["RW"],
    overall: 89, attack: 88, midfield: 86, defense: 42,
    pace: 78, physical: 66, technical: 92, intelligence: 88,
    workRate: 76, creativity: 92, finishing: 82, passing: 86,
    dribbling: 90, pressing: 68, aerial: 54, stamina: 76,
    defensiveAwareness: 40, tackling: 40, positioning: 84,
    transitionThreat: 80, pressResistance: 86, bigGameRating: 86,
    consistency: 82, leadership: 68, versatility: 78, weakFoot: 82,
    setPieces: 72, crossing: 70,
    traits: ["chanceCreator", "technicalMaestro", "dribbleMaestro", "creativeThreat"],
    playstyles: ["possession", "direct", "counterAttack"],
    positions: ["CAM"], face: "faces/wirtz.png", rarity: "special"
  },

  // ── PHIL FODEN ────────────────────────────────────────────
  {
    name: "Phil Foden — 22/23",
    playerGroup: "phil-foden",
    nation: "England", club: "Man City",
    position: "CAM", secondaryPositions: ["LW", "RW"],
    overall: 90, attack: 89, midfield: 84, defense: 44,
    pace: 80, physical: 68, technical: 92, intelligence: 88,
    workRate: 78, creativity: 90, finishing: 84, passing: 84,
    dribbling: 90, pressing: 72, aerial: 60, stamina: 78,
    defensiveAwareness: 42, tackling: 42, positioning: 86,
    transitionThreat: 80, pressResistance: 86, bigGameRating: 86,
    consistency: 84, leadership: 68, versatility: 82, weakFoot: 80,
    setPieces: 68, crossing: 72,
    traits: ["technicalMaestro", "insideForward", "dribbleMaestro", "creativeThreat"],
    playstyles: ["possession", "direct"],
    positions: ["CAM"], face: "faces/foden.png", rarity: "gold"
  },

  // ── RONALDINHO ────────────────────────────────────────────
  {
    name: "Ronaldinho — 05/06",
    playerGroup: "ronaldinho",
    nation: "Brazil", club: "Barcelona",
    position: "CAM", secondaryPositions: ["LW"],
    overall: 97, attack: 94, midfield: 92, defense: 36,
    pace: 82, physical: 72, technical: 99, intelligence: 92,
    workRate: 68, creativity: 99, finishing: 88, passing: 90,
    dribbling: 99, pressing: 56, aerial: 68, stamina: 72,
    defensiveAwareness: 32, tackling: 30, positioning: 88,
    transitionThreat: 86, pressResistance: 92, bigGameRating: 96,
    consistency: 82, leadership: 74, versatility: 82, weakFoot: 92,
    setPieces: 84, crossing: 82,
    traits: ["dribbleMaestro", "creativeThreat", "chanceCreator", "bigGamePlayer", "technicalMaestro"],
    playstyles: ["possession", "direct", "wide"],
    positions: ["CAM"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Ronaldinho — 02/03",
    playerGroup: "ronaldinho",
    nation: "Brazil", club: "PSG",
    position: "CAM", secondaryPositions: ["LW"],
    overall: 90, attack: 88, midfield: 86, defense: 32,
    pace: 84, physical: 70, technical: 96, intelligence: 86,
    workRate: 66, creativity: 96, finishing: 82, passing: 86,
    dribbling: 96, pressing: 52, aerial: 62, stamina: 70,
    defensiveAwareness: 28, tackling: 26, positioning: 82,
    transitionThreat: 82, pressResistance: 88, bigGameRating: 88,
    consistency: 76, leadership: 68, versatility: 76, weakFoot: 90,
    setPieces: 78, crossing: 78,
    traits: ["dribbleMaestro", "creativeThreat", "chanceCreator", "technicalMaestro"],
    playstyles: ["possession", "direct"],
    positions: ["CAM"], face: "faces/default.png", rarity: "special"
  },

  // ══════════════════════════════════════════════════════════
  //  LEFT WING
  // ══════════════════════════════════════════════════════════

  // ── VINICIUS JR ───────────────────────────────────────────
  {
    name: "Vinicius Jr — 22/23",
    playerGroup: "vinicius-jr",
    nation: "Brazil", club: "Real Madrid",
    position: "LW", secondaryPositions: [],
    overall: 92, attack: 92, midfield: 74, defense: 34,
    pace: 97, physical: 74, technical: 88, intelligence: 80,
    workRate: 72, creativity: 88, finishing: 84, passing: 74,
    dribbling: 96, pressing: 62, aerial: 64, stamina: 80,
    defensiveAwareness: 32, tackling: 28, positioning: 82,
    transitionThreat: 96, pressResistance: 80, bigGameRating: 90,
    consistency: 80, leadership: 66, versatility: 66, weakFoot: 74,
    setPieces: 54, crossing: 72,
    traits: ["elitePace", "dribbleMaestro", "insideForward", "paceAbuser", "transitionThreat"],
    playstyles: ["counterAttack", "direct", "wide"],
    positions: ["LW"], face: "faces/vinicius.png", rarity: "special"
  },
  {
    name: "Vinicius Jr — 20/21",
    playerGroup: "vinicius-jr",
    nation: "Brazil", club: "Real Madrid",
    position: "LW", secondaryPositions: [],
    overall: 80, attack: 80, midfield: 62, defense: 28,
    pace: 95, physical: 68, technical: 78, intelligence: 68,
    workRate: 68, creativity: 76, finishing: 66, passing: 62,
    dribbling: 86, pressing: 54, aerial: 56, stamina: 74,
    defensiveAwareness: 26, tackling: 22, positioning: 68,
    transitionThreat: 90, pressResistance: 68, bigGameRating: 72,
    consistency: 64, leadership: 52, versatility: 56, weakFoot: 62,
    setPieces: 42, crossing: 58,
    traits: ["elitePace", "dribbleMaestro", "paceAbuser", "transitionThreat"],
    playstyles: ["counterAttack", "direct"],
    positions: ["LW"], face: "faces/vinicius.png", rarity: "silver"
  },

  // ── KYLIAN MBAPPÉ ─────────────────────────────────────────
  {
    name: "Kylian Mbappé — 21/22",
    playerGroup: "kylian-mbappe",
    nation: "France", club: "PSG",
    position: "LW", secondaryPositions: ["ST"],
    overall: 93, attack: 93, midfield: 76, defense: 36,
    pace: 97, physical: 78, technical: 88, intelligence: 86,
    workRate: 72, creativity: 84, finishing: 92, passing: 80,
    dribbling: 90, pressing: 64, aerial: 74, stamina: 82,
    defensiveAwareness: 34, tackling: 26, positioning: 92,
    transitionThreat: 97, pressResistance: 86, bigGameRating: 94,
    consistency: 88, leadership: 78, versatility: 80, weakFoot: 84,
    setPieces: 68, crossing: 76,
    traits: ["eliteFinisher", "elitePace", "transitionThreat", "paceAbuser", "bigGamePlayer", "insideForward"],
    playstyles: ["counterAttack", "direct", "vertical"],
    positions: ["LW"], face: "faces/mbappe.png", rarity: "special"
  },
  {
    name: "Kylian Mbappé — 18/19",
    playerGroup: "kylian-mbappe",
    nation: "France", club: "PSG",
    position: "LW", secondaryPositions: ["ST"],
    overall: 88, attack: 88, midfield: 70, defense: 32,
    pace: 96, physical: 74, technical: 84, intelligence: 80,
    workRate: 68, creativity: 78, finishing: 86, passing: 74,
    dribbling: 86, pressing: 58, aerial: 68, stamina: 78,
    defensiveAwareness: 30, tackling: 22, positioning: 86,
    transitionThreat: 94, pressResistance: 80, bigGameRating: 88,
    consistency: 82, leadership: 68, versatility: 74, weakFoot: 78,
    setPieces: 60, crossing: 68,
    traits: ["eliteFinisher", "elitePace", "transitionThreat", "paceAbuser", "bigGamePlayer"],
    playstyles: ["counterAttack", "direct", "vertical"],
    positions: ["LW"], face: "faces/mbappe.png", rarity: "gold"
  },

  // ── BUKAYO SAKA ───────────────────────────────────────────
  {
    name: "Bukayo Saka — 23/24",
    playerGroup: "bukayo-saka",
    nation: "England", club: "Arsenal",
    position: "LW", secondaryPositions: ["RW"],
    overall: 89, attack: 89, midfield: 78, defense: 56,
    pace: 84, physical: 72, technical: 86, intelligence: 84,
    workRate: 88, creativity: 84, finishing: 78, passing: 82,
    dribbling: 88, pressing: 82, aerial: 64, stamina: 88,
    defensiveAwareness: 52, tackling: 54, positioning: 82,
    transitionThreat: 82, pressResistance: 82, bigGameRating: 86,
    consistency: 88, leadership: 74, versatility: 84, weakFoot: 80,
    setPieces: 70, crossing: 80,
    traits: ["consistentPerformer", "dribbleMaestro", "insideForward", "highWorkRate"],
    playstyles: ["highPress", "wide", "possession"],
    positions: ["LW"], face: "faces/saka.png", rarity: "gold"
  },

  // ── RYAN GIGGS ────────────────────────────────────────────
  {
    name: "Ryan Giggs — 98/99",
    playerGroup: "ryan-giggs",
    nation: "Wales", club: "Man United",
    position: "LW", secondaryPositions: [],
    overall: 90, attack: 88, midfield: 76, defense: 42,
    pace: 92, physical: 72, technical: 88, intelligence: 82,
    workRate: 82, creativity: 88, finishing: 72, passing: 80,
    dribbling: 92, pressing: 66, aerial: 60, stamina: 84,
    defensiveAwareness: 40, tackling: 42, positioning: 78,
    transitionThreat: 90, pressResistance: 78, bigGameRating: 88,
    consistency: 84, leadership: 76, versatility: 72, weakFoot: 68,
    setPieces: 66, crossing: 80,
    traits: ["elitePace", "dribbleMaestro", "bigGamePlayer", "consistentPerformer"],
    playstyles: ["direct", "wide", "counterAttack"],
    positions: ["LW"], face: "faces/default.png", rarity: "special"
  },

  // ══════════════════════════════════════════════════════════
  //  RIGHT WING
  // ══════════════════════════════════════════════════════════

  // ── MOHAMED SALAH ─────────────────────────────────────────
  {
    name: "Mohamed Salah — 17/18",
    playerGroup: "mohamed-salah",
    nation: "Egypt", club: "Liverpool",
    position: "RW", secondaryPositions: ["ST"],
    overall: 92, attack: 92, midfield: 74, defense: 44,
    pace: 92, physical: 74, technical: 88, intelligence: 88,
    workRate: 84, creativity: 82, finishing: 92, passing: 78,
    dribbling: 90, pressing: 72, aerial: 62, stamina: 88,
    defensiveAwareness: 42, tackling: 40, positioning: 90,
    transitionThreat: 90, pressResistance: 84, bigGameRating: 90,
    consistency: 92, leadership: 72, versatility: 74, weakFoot: 80,
    setPieces: 66, crossing: 68,
    traits: ["eliteFinisher", "insideForward", "consistentPerformer", "paceAbuser"],
    playstyles: ["counterAttack", "direct", "wide"],
    positions: ["RW"], face: "faces/salah.png", rarity: "special"
  },
  {
    name: "Mohamed Salah — 21/22",
    playerGroup: "mohamed-salah",
    nation: "Egypt", club: "Liverpool",
    position: "RW", secondaryPositions: ["ST"],
    overall: 91, attack: 91, midfield: 72, defense: 44,
    pace: 90, physical: 74, technical: 86, intelligence: 86,
    workRate: 82, creativity: 80, finishing: 90, passing: 76,
    dribbling: 88, pressing: 70, aerial: 62, stamina: 86,
    defensiveAwareness: 42, tackling: 40, positioning: 88,
    transitionThreat: 88, pressResistance: 82, bigGameRating: 88,
    consistency: 90, leadership: 72, versatility: 74, weakFoot: 80,
    setPieces: 66, crossing: 68,
    traits: ["eliteFinisher", "insideForward", "consistentPerformer", "paceAbuser"],
    playstyles: ["counterAttack", "direct", "wide"],
    positions: ["RW"], face: "faces/salah.png", rarity: "gold"
  },

  // ── CRISTIANO RONALDO ─────────────────────────────────────
  {
    name: "Cristiano Ronaldo — 07/08",
    playerGroup: "cristiano-ronaldo",
    nation: "Portugal", club: "Man United",
    position: "RW", secondaryPositions: ["LW", "ST"],
    overall: 91, attack: 90, midfield: 72, defense: 38,
    pace: 94, physical: 80, technical: 90, intelligence: 82,
    workRate: 84, creativity: 86, finishing: 86, passing: 76,
    dribbling: 92, pressing: 66, aerial: 78, stamina: 84,
    defensiveAwareness: 36, tackling: 32, positioning: 84,
    transitionThreat: 90, pressResistance: 80, bigGameRating: 90,
    consistency: 82, leadership: 80, versatility: 82, weakFoot: 74,
    setPieces: 78, crossing: 76,
    traits: ["eliteFinisher", "dribbleMaestro", "paceAbuser", "bigGamePlayer", "setPieceThreat"],
    playstyles: ["direct", "wide", "counterAttack"],
    positions: ["RW"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Cristiano Ronaldo — 13/14",
    playerGroup: "cristiano-ronaldo",
    nation: "Portugal", club: "Real Madrid",
    position: "RW", secondaryPositions: ["LW", "ST"],
    overall: 96, attack: 96, midfield: 74, defense: 36,
    pace: 90, physical: 84, technical: 90, intelligence: 88,
    workRate: 82, creativity: 84, finishing: 96, passing: 78,
    dribbling: 90, pressing: 64, aerial: 86, stamina: 88,
    defensiveAwareness: 34, tackling: 30, positioning: 94,
    transitionThreat: 90, pressResistance: 82, bigGameRating: 97,
    consistency: 90, leadership: 86, versatility: 80, weakFoot: 80,
    setPieces: 84, crossing: 72,
    traits: ["eliteFinisher", "setPieceThreat", "aerialThreat", "bigGamePlayer", "penaltyBoxPredator"],
    playstyles: ["direct", "wide", "counterAttack"],
    positions: ["RW"], face: "faces/default.png", rarity: "special"
  },

  // ── DAVID BECKHAM ─────────────────────────────────────────
  {
    name: "David Beckham — 98/99",
    playerGroup: "david-beckham",
    nation: "England", club: "Man United",
    position: "RW", secondaryPositions: ["CM"],
    overall: 88, attack: 80, midfield: 82, defense: 46,
    pace: 72, physical: 70, technical: 86, intelligence: 84,
    workRate: 86, creativity: 84, finishing: 70, passing: 90,
    dribbling: 74, pressing: 70, aerial: 62, stamina: 82,
    defensiveAwareness: 44, tackling: 50, positioning: 76,
    transitionThreat: 62, pressResistance: 78, bigGameRating: 90,
    consistency: 84, leadership: 80, versatility: 76, weakFoot: 64,
    setPieces: 98, crossing: 96,
    traits: ["crossingSpecialist", "setPieceExpert", "visionPasser", "bigGamePlayer"],
    playstyles: ["wide", "possession", "direct"],
    positions: ["RW"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "David Beckham — 02/03",
    playerGroup: "david-beckham",
    nation: "England", club: "Real Madrid",
    position: "RW", secondaryPositions: ["CM"],
    overall: 85, attack: 76, midfield: 80, defense: 44,
    pace: 68, physical: 68, technical: 84, intelligence: 82,
    workRate: 84, creativity: 80, finishing: 66, passing: 88,
    dribbling: 70, pressing: 66, aerial: 60, stamina: 80,
    defensiveAwareness: 42, tackling: 46, positioning: 72,
    transitionThreat: 56, pressResistance: 74, bigGameRating: 86,
    consistency: 80, leadership: 78, versatility: 72, weakFoot: 60,
    setPieces: 96, crossing: 94,
    traits: ["crossingSpecialist", "setPieceExpert", "visionPasser"],
    playstyles: ["wide", "possession"],
    positions: ["RW"], face: "faces/default.png", rarity: "gold"
  },

  // ── FLORIAN WIRTZ RW ──────────────────────────────────────
  {
    name: "Florian Wirtz — 22/23",
    playerGroup: "florian-wirtz-rw",
    nation: "Germany", club: "Bayer Leverkusen",
    position: "RW", secondaryPositions: ["CAM"],
    overall: 85, attack: 84, midfield: 80, defense: 38,
    pace: 76, physical: 62, technical: 90, intelligence: 84,
    workRate: 72, creativity: 88, finishing: 78, passing: 82,
    dribbling: 88, pressing: 64, aerial: 50, stamina: 72,
    defensiveAwareness: 36, tackling: 36, positioning: 80,
    transitionThreat: 76, pressResistance: 82, bigGameRating: 80,
    consistency: 78, leadership: 62, versatility: 74, weakFoot: 78,
    setPieces: 66, crossing: 66,
    traits: ["dribbleMaestro", "creativeThreat", "chanceCreator"],
    playstyles: ["possession", "direct"],
    positions: ["RW"], face: "faces/wirtz.png", rarity: "gold"
  },

  // ══════════════════════════════════════════════════════════
  //  STRIKERS
  // ══════════════════════════════════════════════════════════

  // ── ERLING HAALAND ────────────────────────────────────────
  {
    name: "Erling Haaland — 22/23",
    playerGroup: "erling-haaland",
    nation: "Norway", club: "Man City",
    position: "ST", secondaryPositions: [],
    overall: 94, attack: 95, midfield: 58, defense: 22,
    pace: 88, physical: 92, technical: 76, intelligence: 82,
    workRate: 68, creativity: 62, finishing: 98, passing: 62,
    dribbling: 74, pressing: 58, aerial: 90, stamina: 82,
    defensiveAwareness: 22, tackling: 18, positioning: 96,
    transitionThreat: 90, pressResistance: 78, bigGameRating: 90,
    consistency: 86, leadership: 74, versatility: 42, weakFoot: 74,
    setPieces: 68, crossing: 42,
    traits: ["eliteFinisher", "aerialDominator", "penaltyBoxPredator", "physicalBeast", "paceAbuser"],
    playstyles: ["direct", "counterAttack", "vertical"],
    positions: ["ST"], face: "faces/haaland.png", rarity: "special"
  },
  {
    name: "Erling Haaland — 20/21",
    playerGroup: "erling-haaland",
    nation: "Norway", club: "Borussia Dortmund",
    position: "ST", secondaryPositions: [],
    overall: 88, attack: 88, midfield: 52, defense: 20,
    pace: 86, physical: 86, technical: 70, intelligence: 76,
    workRate: 64, creativity: 56, finishing: 92, passing: 56,
    dribbling: 68, pressing: 52, aerial: 84, stamina: 78,
    defensiveAwareness: 20, tackling: 16, positioning: 90,
    transitionThreat: 86, pressResistance: 70, bigGameRating: 82,
    consistency: 80, leadership: 64, versatility: 36, weakFoot: 68,
    setPieces: 60, crossing: 38,
    traits: ["eliteFinisher", "aerialDominator", "penaltyBoxPredator", "physicalBeast"],
    playstyles: ["direct", "counterAttack"],
    positions: ["ST"], face: "faces/haaland.png", rarity: "gold"
  },

  // ── HARRY KANE ────────────────────────────────────────────
  {
    name: "Harry Kane — 20/21",
    playerGroup: "harry-kane",
    nation: "England", club: "Tottenham",
    position: "ST", secondaryPositions: [],
    overall: 90, attack: 91, midfield: 70, defense: 28,
    pace: 72, physical: 80, technical: 82, intelligence: 92,
    workRate: 78, creativity: 76, finishing: 90, passing: 82,
    dribbling: 72, pressing: 66, aerial: 86, stamina: 78,
    defensiveAwareness: 26, tackling: 24, positioning: 92,
    transitionThreat: 66, pressResistance: 82, bigGameRating: 88,
    consistency: 86, leadership: 84, versatility: 66, weakFoot: 82,
    setPieces: 80, crossing: 52,
    traits: ["eliteFinisher", "setPieceThreat", "linkUpPlay", "intelligentMover", "leader"],
    playstyles: ["possession", "direct", "wide"],
    positions: ["ST"], face: "faces/kane.png", rarity: "gold"
  },
  {
    name: "Harry Kane — 23/24",
    playerGroup: "harry-kane",
    nation: "England", club: "Bayern Munich",
    position: "ST", secondaryPositions: [],
    overall: 91, attack: 92, midfield: 72, defense: 28,
    pace: 70, physical: 82, technical: 84, intelligence: 92,
    workRate: 80, creativity: 78, finishing: 92, passing: 84,
    dribbling: 72, pressing: 68, aerial: 88, stamina: 80,
    defensiveAwareness: 26, tackling: 24, positioning: 94,
    transitionThreat: 68, pressResistance: 84, bigGameRating: 90,
    consistency: 88, leadership: 86, versatility: 68, weakFoot: 84,
    setPieces: 82, crossing: 54,
    traits: ["eliteFinisher", "setPieceThreat", "linkUpPlay", "intelligentMover", "leader"],
    playstyles: ["possession", "direct"],
    positions: ["ST"], face: "faces/kane.png", rarity: "gold"
  },

  // ── RONALDO (R9) ──────────────────────────────────────────
  {
    name: "Ronaldo R9 — 97/98",
    playerGroup: "ronaldo-r9",
    nation: "Brazil", club: "Inter Milan",
    position: "ST", secondaryPositions: [],
    overall: 97, attack: 97, midfield: 66, defense: 24,
    pace: 96, physical: 88, technical: 92, intelligence: 88,
    workRate: 72, creativity: 84, finishing: 98, passing: 72,
    dribbling: 94, pressing: 58, aerial: 78, stamina: 80,
    defensiveAwareness: 22, tackling: 20, positioning: 96,
    transitionThreat: 96, pressResistance: 82, bigGameRating: 98,
    consistency: 86, leadership: 78, versatility: 60, weakFoot: 84,
    setPieces: 70, crossing: 52,
    traits: ["eliteFinisher", "paceAbuser", "dribbleMaestro", "penaltyBoxPredator", "bigGamePlayer", "physicalBeast"],
    playstyles: ["direct", "counterAttack", "vertical"],
    positions: ["ST"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Ronaldo R9 — 02/03",
    playerGroup: "ronaldo-r9",
    nation: "Brazil", club: "Real Madrid",
    position: "ST", secondaryPositions: [],
    overall: 94, attack: 94, midfield: 62, defense: 22,
    pace: 88, physical: 86, technical: 88, intelligence: 86,
    workRate: 68, creativity: 80, finishing: 96, passing: 68,
    dribbling: 90, pressing: 54, aerial: 76, stamina: 76,
    defensiveAwareness: 20, tackling: 18, positioning: 94,
    transitionThreat: 90, pressResistance: 78, bigGameRating: 94,
    consistency: 80, leadership: 74, versatility: 56, weakFoot: 82,
    setPieces: 66, crossing: 48,
    traits: ["eliteFinisher", "paceAbuser", "penaltyBoxPredator", "bigGamePlayer"],
    playstyles: ["direct", "counterAttack"],
    positions: ["ST"], face: "faces/default.png", rarity: "special"
  },

  // ── ROBERT LEWANDOWSKI ────────────────────────────────────
  {
    name: "Robert Lewandowski — 20/21",
    playerGroup: "robert-lewandowski",
    nation: "Poland", club: "Bayern Munich",
    position: "ST", secondaryPositions: [],
    overall: 93, attack: 93, midfield: 70, defense: 26,
    pace: 76, physical: 84, technical: 86, intelligence: 92,
    workRate: 78, creativity: 74, finishing: 97, passing: 78,
    dribbling: 76, pressing: 68, aerial: 86, stamina: 80,
    defensiveAwareness: 24, tackling: 22, positioning: 98,
    transitionThreat: 68, pressResistance: 84, bigGameRating: 90,
    consistency: 92, leadership: 82, versatility: 64, weakFoot: 84,
    setPieces: 76, crossing: 46,
    traits: ["eliteFinisher", "penaltyBoxPredator", "intelligentMover", "setPieceThreat", "consistentPerformer"],
    playstyles: ["possession", "direct"],
    positions: ["ST"], face: "faces/lewandowski.png", rarity: "special"
  },
  {
    name: "Robert Lewandowski — 16/17",
    playerGroup: "robert-lewandowski",
    nation: "Poland", club: "Bayern Munich",
    position: "ST", secondaryPositions: [],
    overall: 90, attack: 91, midfield: 66, defense: 24,
    pace: 74, physical: 82, technical: 84, intelligence: 90,
    workRate: 76, creativity: 70, finishing: 94, passing: 74,
    dribbling: 74, pressing: 64, aerial: 84, stamina: 78,
    defensiveAwareness: 22, tackling: 20, positioning: 96,
    transitionThreat: 64, pressResistance: 82, bigGameRating: 86,
    consistency: 90, leadership: 78, versatility: 60, weakFoot: 82,
    setPieces: 72, crossing: 42,
    traits: ["eliteFinisher", "penaltyBoxPredator", "intelligentMover", "consistentPerformer"],
    playstyles: ["possession", "direct"],
    positions: ["ST"], face: "faces/lewandowski.png", rarity: "gold"
  },

  // ── THIERRY HENRY ─────────────────────────────────────────
  {
    name: "Thierry Henry — 03/04",
    playerGroup: "thierry-henry",
    nation: "France", club: "Arsenal",
    position: "ST", secondaryPositions: ["LW"],
    overall: 96, attack: 96, midfield: 72, defense: 34,
    pace: 94, physical: 80, technical: 92, intelligence: 90,
    workRate: 78, creativity: 86, finishing: 94, passing: 80,
    dribbling: 90, pressing: 64, aerial: 72, stamina: 82,
    defensiveAwareness: 32, tackling: 28, positioning: 94,
    transitionThreat: 94, pressResistance: 84, bigGameRating: 92,
    consistency: 90, leadership: 80, versatility: 78, weakFoot: 78,
    setPieces: 72, crossing: 76,
    traits: ["eliteFinisher", "paceAbuser", "dribbleMaestro", "insideForward", "bigGamePlayer", "transitionThreat"],
    playstyles: ["direct", "counterAttack", "wide"],
    positions: ["ST"], face: "faces/default.png", rarity: "special"
  },
  {
    name: "Thierry Henry — 98/99",
    playerGroup: "thierry-henry",
    nation: "France", club: "Juventus",
    position: "ST", secondaryPositions: ["LW"],
    overall: 83, attack: 82, midfield: 64, defense: 30,
    pace: 94, physical: 74, technical: 80, intelligence: 76,
    workRate: 72, creativity: 74, finishing: 78, passing: 70,
    dribbling: 82, pressing: 58, aerial: 64, stamina: 76,
    defensiveAwareness: 28, tackling: 24, positioning: 80,
    transitionThreat: 90, pressResistance: 72, bigGameRating: 78,
    consistency: 72, leadership: 62, versatility: 68, weakFoot: 70,
    setPieces: 58, crossing: 64,
    traits: ["paceAbuser", "dribbleMaestro", "transitionThreat"],
    playstyles: ["direct", "counterAttack"],
    positions: ["ST"], face: "faces/default.png", rarity: "silver"
  },

  // ── VICTOR OSIMHEN ────────────────────────────────────────
  {
    name: "Victor Osimhen — 22/23",
    playerGroup: "victor-osimhen",
    nation: "Nigeria", club: "Napoli",
    position: "ST", secondaryPositions: [],
    overall: 89, attack: 90, midfield: 60, defense: 24,
    pace: 92, physical: 88, technical: 74, intelligence: 76,
    workRate: 72, creativity: 62, finishing: 88, passing: 60,
    dribbling: 74, pressing: 64, aerial: 82, stamina: 80,
    defensiveAwareness: 22, tackling: 20, positioning: 86,
    transitionThreat: 92, pressResistance: 72, bigGameRating: 84,
    consistency: 80, leadership: 70, versatility: 50, weakFoot: 70,
    setPieces: 58, crossing: 36,
    traits: ["paceAbuser", "physicalBeast", "transitionThreat", "aerialThreat"],
    playstyles: ["counterAttack", "direct", "vertical"],
    positions: ["ST"], face: "faces/osimhen.png", rarity: "gold"
  },

  // ── LAUTARO MARTÍNEZ ──────────────────────────────────────
  {
    name: "Lautaro Martínez — 22/23",
    playerGroup: "lautaro-martinez",
    nation: "Argentina", club: "Inter Milan",
    position: "ST", secondaryPositions: [],
    overall: 88, attack: 89, midfield: 66, defense: 30,
    pace: 78, physical: 80, technical: 82, intelligence: 84,
    workRate: 80, creativity: 70, finishing: 88, passing: 70,
    dribbling: 80, pressing: 72, aerial: 76, stamina: 80,
    defensiveAwareness: 28, tackling: 26, positioning: 88,
    transitionThreat: 76, pressResistance: 78, bigGameRating: 86,
    consistency: 84, leadership: 76, versatility: 62, weakFoot: 78,
    setPieces: 66, crossing: 44,
    traits: ["eliteFinisher", "penaltyBoxPredator", "intelligentMover", "bigGamePlayer"],
    playstyles: ["possession", "direct", "counterAttack"],
    positions: ["ST"], face: "faces/lautaro.png", rarity: "gold"
  },

];
