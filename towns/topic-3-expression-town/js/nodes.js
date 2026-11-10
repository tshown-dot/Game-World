/**
 * Super Mario World Style Overworld - Town & Building Registry
 * 
 * mapCoords = stage-tile position in the 1366x658 overworld map space (see js/worldArt.js).
 * Maps 6th Grade Topic 3 lessons (Numeric and Algebraic Expressions) to buildings in "Expression Town".
 * Designed with multi-town/chapter extensibility for future topics.
 */

export const WORLD_CHAPTERS = [
  {
    id: 'topic_1',
    worldLabel: 'WORLD 1',
    title: 'Decimal Docks',
    subtitle: 'Use Positive Rational Numbers',
    isLockedChapter: true,
  },
  {
    id: 'topic_2',
    worldLabel: 'WORLD 2',
    title: 'Integer Highlands',
    subtitle: 'Integers and Rational Numbers',
    isLockedChapter: true,
  },
  {
    id: 'topic_3',
    worldLabel: 'WORLD 3',
    title: 'Expression Town',
    subtitle: 'Numeric & Algebraic Expressions',
    isLockedChapter: false,
    isActive: true,
  },
  {
    id: 'topic_4',
    worldLabel: 'WORLD 4',
    title: 'Equation Valley',
    subtitle: 'Represent and Solve Equations & Inequalities',
    isLockedChapter: true,
  },
];

export const REALM_NODES = [
  {
    id: 'node_3_1',
    lessonId: 'G06_U03_L01',
    lessonCode: '3-1',
    title: 'Power Plant',
    buildingType: 'power_plant',
    regionName: 'West Town Plaza',
    subtitle: 'Exponents & Repeated Multiplication',
    description: 'Step inside the Town Power Plant! Balance high-voltage surge waves by dialing bases and exponents before the generator overloads.',
    standard: 'enVision 2.0 Lesson 3-1: Understand and Apply Exponents',
    cartridgeUrl: './cartridges/exponents/index.html',
    icon: '⚡',
    accent: '#3f6fd8',
    badgeName: 'Spark Badge',
    mapCoords: { x: 120, y: 490 },
    requiredNodeId: null, // Starting building - door is unlocked!
    xpReward: 150,
    coinsReward: 50,
    isWip: false,
    bossName: 'Singularity Core',
  },
  {
    id: 'node_3_2',
    lessonId: 'G06_U03_L02',
    lessonCode: '3-2',
    title: 'Town Bank Vault',
    buildingType: 'bank_vault',
    regionName: 'Gold Street',
    subtitle: 'Greatest Common Factor (GCF)',
    description: 'Rob the Town Bank! Crack dials, split the loot, tile the vault floor, and smash the Vault Golem, all with the Greatest Common Factor, before the heat catches up with you.',
    standard: 'enVision 2.0 Lesson 3-2: Find the Greatest Common Factor',
    cartridgeUrl: './cartridges/gcf/index.html',
    icon: '🏦',
    accent: '#e0a91a',
    badgeName: 'Vault Key',
    mapCoords: { x: 220, y: 270 },
    requiredNodeId: 'node_3_1',
    xpReward: 200,
    coinsReward: 60,
    isWip: false,
    bossName: 'The Vault Golem',
  },
  {
    id: 'node_3_2_lcm',
    lessonId: 'G06_U03_L02_LCM',
    lessonCode: '3-2',
    title: 'Substation Grid',
    buildingType: 'substation',
    regionName: 'Powerline Plaza',
    subtitle: 'Least Common Multiple (LCM)',
    description: 'Power pulses are hopping out of sync! Drop breakers where they first collide, stock up with the fewest packs, decide GCF or LCM, and shut down the Dynamo Overlord, all with the Least Common Multiple.',
    standard: 'enVision 2.0 Lesson 3-2: Find the Least Common Multiple',
    cartridgeUrl: './cartridges/lcm/index.html',
    icon: '🔋',
    accent: '#19b3a6',
    badgeName: 'Grid Star',
    mapCoords: { x: 385, y: 270 },
    requiredNodeId: 'node_3_2',
    xpReward: 200,
    coinsReward: 60,
    isWip: false,
    bossName: 'Dynamo Overlord',
  },
  {
    id: 'node_3_3',
    lessonId: 'G06_U03_L03',
    lessonCode: '3-3',
    title: 'Demolition Yard',
    buildingType: 'crane_yard',
    regionName: 'Ironworks Corner',
    subtitle: 'Order of Operations (PEMDAS)',
    description: 'Climb into the Demolition Crane cab! Swing the wrecking ball at mathematical operators in strict PEMDAS order to demolish girders.',
    standard: 'enVision 2.0 Lesson 3-3: Write and Evaluate Numerical Expressions',
    cartridgeUrl: './cartridges/crane/index.html',
    icon: '🏗️',
    accent: '#ff8a2b',
    badgeName: 'Hardhat Badge',
    mapCoords: { x: 470, y: 490 },
    requiredNodeId: 'node_3_2_lcm',
    xpReward: 250,
    coinsReward: 75,
    isWip: false,
    bossName: 'Titan Demolisher',
  },
  {
    id: 'node_3_4_expr',
    lessonId: 'G06_U03_L04',
    lessonCode: '3-4',
    title: 'Signal Observatory',
    buildingType: 'observatory',
    regionName: 'Stargazer Hill',
    subtitle: 'Write Algebraic Expressions',
    description: 'Aliens are calling Expression Town! Decode their word messages into algebra, name the parts of an expression, and use the Test Beam to prove when a translation changes the meaning.',
    standard: 'enVision 2.0 Lesson 3-4: Write Algebraic Expressions',
    cartridgeUrl: './cartridges/algebraic/index.html',
    icon: '📡',
    accent: '#7c4dff',
    badgeName: 'Decoder Ring',
    mapCoords: { x: 700, y: 270 },
    requiredNodeId: 'node_3_3',
    xpReward: 250,
    coinsReward: 75,
    isWip: false,
    bossName: 'Reverse Transmission',
  },
  {
    id: 'node_3_5',
    lessonId: 'G06_U03_L05',
    lessonCode: '3-5',
    title: 'Variable Vault',
    buildingType: 'security_vault',
    regionName: 'Archives Row',
    subtitle: 'Evaluate Algebraic Expressions',
    description: 'Infiltrate the high-security Variable Vault! Drag values to substitute for variables, apply order of operations, and crack security codes across 5 vaults.',
    standard: 'enVision 2.0 Lesson 3-5: Evaluate Algebraic Expressions',
    cartridgeUrl: './cartridges/evaluating/index.html',
    icon: '🔐',
    accent: '#4a3fb5',
    badgeName: 'Cipher Key',
    mapCoords: { x: 860, y: 490 },
    requiredNodeId: 'node_3_4_expr',
    xpReward: 300,
    coinsReward: 85,
    isWip: false,
    bossName: 'Grand Master Vault',
  },
  {
    id: 'node_3_6',
    lessonId: 'G06_U03_L06',
    lessonCode: '3-6',
    title: 'Drone Depot',
    buildingType: 'drone_depot',
    regionName: 'Skyport Row',
    subtitle: 'The Distributive Property',
    description: 'Take off from the Drone Depot! The number outside the parentheses is your drone, and every term inside is a house. Deliver to EVERY house, then fly the routes in reverse to find the GCF.',
    standard: 'enVision 2.0 Lesson 3-6: Generate Equivalent Expressions with the Distributive Property',
    cartridgeUrl: './cartridges/distributive/index.html',
    icon: '🚁',
    accent: '#2f80ed',
    badgeName: 'Pilot Wings',
    mapCoords: { x: 1010, y: 270 },
    requiredNodeId: 'node_3_5',
    xpReward: 300,
    coinsReward: 85,
    isWip: false,
    bossName: "The Inspector's Office",
  },
  {
    id: 'node_3_7',
    lessonId: 'G06_U03_L07',
    lessonCode: '3-7',
    title: 'Target Arcade',
    buildingType: 'arcade',
    regionName: 'East Boardwalk',
    subtitle: 'Combining Like Terms',
    description: 'Enter the Town Target Arcade! Fire terms into the stack: like terms combine, opposites cancel to zero and pop, and unlike terms just stick. Beat the shape-shifting Term Colossus!',
    standard: 'enVision 2.0 Lesson 3-7: Simplify Algebraic Expressions by Combining Like Terms',
    cartridgeUrl: './cartridges/shooter/index.html',
    icon: '🎯',
    accent: '#8b46d8',
    badgeName: 'Sharpshooter Star',
    mapCoords: { x: 1150, y: 490 },
    requiredNodeId: 'node_3_6',
    xpReward: 300,
    coinsReward: 90,
    isWip: false,
    bossName: 'Term Colossus',
  },
  {
    id: 'node_apex',
    lessonId: 'G06_U03_BOSS',
    lessonCode: 'BOSS',
    title: 'Boss Castle',
    buildingType: 'castle',
    regionName: 'Citadel Peak',
    subtitle: 'Topic 3 Grand Master Climax',
    description: 'The final fortress of Expression Town! Enter the Boss Castle and prove your mastery over exponents, factors, multiples, PEMDAS, and algebraic expressions!',
    standard: 'enVision 2.0 Topic 3 Climax: Numeric and Algebraic Expressions Mastery',
    cartridgeUrl: './cartridges/crane/index.html',
    icon: '🏰',
    accent: '#e5484d',
    badgeName: 'Town Champion Crown',
    mapCoords: { x: 1262, y: 296 },
    requiredNodeId: 'node_3_7',
    xpReward: 600,
    coinsReward: 250,
    isWip: false,
    bossName: 'Expression Colossus Prime',
  }
];

/**
 * Returns effective prerequisite ID for a node, accounting for WIP buildings.
 */
export function getEffectivePrerequisite(nodeId) {
  const node = REALM_NODES.find(n => n.id === nodeId);
  if (!node || !node.requiredNodeId) return null;

  const prereq = REALM_NODES.find(n => n.id === node.requiredNodeId);
  if (prereq && prereq.isWip) {
    return prereq.requiredNodeId;
  }
  return node.requiredNodeId;
}

/**
 * Checks if a building door is unlocked based on unlocked node set or teacher override.
 */
export function isNodeUnlocked(nodeId, unlockedNodeIds = [], isTeacherOverride = false) {
  if (isTeacherOverride) return true;
  const node = REALM_NODES.find(n => n.id === nodeId);
  if (!node) return false;
  if (!node.requiredNodeId) return true; // Building 3-1 is always open

  return unlockedNodeIds.includes(nodeId);
}
