/** SoulBound spawn windows transcribed from the user's SoulBound MVP table (2026-10-16).
 * Units are minutes; fractional minutes retain the seconds in 86:40 and 94:10.
 * Only the supplied 26 MVP spawns are included. Mini-boss references remain provisional.
 */
export type MvpSpawn = {bossKey:string;name:string;mapKey:string;mapName:string;minMinutes:number;maxMinutes:number;kind?:"mvp"|"mini"};
export const MVP_SPAWNS: MvpSpawn[] = [
  {
    "bossKey": "amon_ra",
    "name": "Amon Ra",
    "mapKey": "moc_pryd06",
    "mapName": "Pyramid B4",
    "minMinutes": 60,
    "maxMinutes": 86.66666666666667
  },
  {
    "bossKey": "baphomet",
    "name": "Baphomet",
    "mapKey": "prt_maze03",
    "mapName": "Prontera Maze 3",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "dark_lord",
    "name": "Dark Lord",
    "mapKey": "gl_chyard",
    "mapName": "Glast Heim Churchyard",
    "minMinutes": 60,
    "maxMinutes": 90
  },
  {
    "bossKey": "dark_lord",
    "name": "Dark Lord",
    "mapKey": "gld_dun04",
    "mapName": "Guild Dungeon 4",
    "minMinutes": 480,
    "maxMinutes": 600
  },
  {
    "bossKey": "doppelganger",
    "name": "Doppelganger",
    "mapKey": "gef_dun02",
    "mapName": "Geffen Dungeon 3",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "doppelganger",
    "name": "Doppelganger",
    "mapKey": "gld_dun02",
    "mapName": "Guild Dungeon 2",
    "minMinutes": 480,
    "maxMinutes": 600
  },
  {
    "bossKey": "dracula",
    "name": "Dracula",
    "mapKey": "gef_dun01",
    "mapName": "Geffen Dungeon 2",
    "minMinutes": 60,
    "maxMinutes": 90
  },
  {
    "bossKey": "drake",
    "name": "Drake",
    "mapKey": "treasure02",
    "mapName": "Sunken Ship 2",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "eddga",
    "name": "Eddga",
    "mapKey": "gld_dun01",
    "mapName": "Guild Dungeon 1",
    "minMinutes": 480,
    "maxMinutes": 600
  },
  {
    "bossKey": "eddga",
    "name": "Eddga",
    "mapKey": "pay_fild11",
    "mapName": "Payon Field 11",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "evil_snake_lord",
    "name": "Evil Snake Lord",
    "mapKey": "gon_dun03",
    "mapName": "Gonryun Dungeon 3",
    "minMinutes": 94.16666666666667,
    "maxMinutes": 155
  },
  {
    "bossKey": "golden_thief_bug",
    "name": "Golden Thief Bug",
    "mapKey": "prt_sewb4",
    "mapName": "Prontera Culvert 4",
    "minMinutes": 60,
    "maxMinutes": 90
  },
  {
    "bossKey": "garm",
    "name": "Hatii",
    "mapKey": "xmas_fild01",
    "mapName": "Lutie Field",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "maya",
    "name": "Maya",
    "mapKey": "anthell02",
    "mapName": "Ant Hell 2",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "maya",
    "name": "Maya",
    "mapKey": "gld_dun03",
    "mapName": "Guild Dungeon 3",
    "minMinutes": 480,
    "maxMinutes": 600
  },
  {
    "bossKey": "mistress",
    "name": "Mistress",
    "mapKey": "mjolnir_04",
    "mapName": "Mt. Mjolnir 4",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "moonlight_flower",
    "name": "Moonlight Flower",
    "mapKey": "pay_dun04",
    "mapName": "Payon Cave 5",
    "minMinutes": 60,
    "maxMinutes": 180
  },
  {
    "bossKey": "orc_hero",
    "name": "Orc Hero",
    "mapKey": "gef_fild14",
    "mapName": "Geffen Field 14",
    "minMinutes": 60,
    "maxMinutes": 90
  },
  {
    "bossKey": "orc_lord",
    "name": "Orc Lord",
    "mapKey": "gef_fild10",
    "mapName": "Geffen Field 10",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "osiris",
    "name": "Osiris",
    "mapKey": "moc_pryd04",
    "mapName": "Pyramid 4",
    "minMinutes": 60,
    "maxMinutes": 180
  },
  {
    "bossKey": "pharaoh",
    "name": "Pharaoh",
    "mapKey": "in_sphinx5",
    "mapName": "Sphinx 5",
    "minMinutes": 60,
    "maxMinutes": 90
  },
  {
    "bossKey": "phreeoni",
    "name": "Phreeoni",
    "mapKey": "moc_fild15",
    "mapName": "Sograt Desert 15",
    "minMinutes": 120,
    "maxMinutes": 180
  },
  {
    "bossKey": "incantation_samurai",
    "name": "Samurai Specter",
    "mapKey": "ama_dun03",
    "mapName": "Amatsu Dungeon 3",
    "minMinutes": 91,
    "maxMinutes": 151
  },
  {
    "bossKey": "stormy_knight",
    "name": "Stormy Knight",
    "mapKey": "xmas_dun02",
    "mapName": "Toy Factory 2",
    "minMinutes": 60,
    "maxMinutes": 180
  },
  {
    "bossKey": "tao_gunka",
    "name": "Tao Gunka",
    "mapKey": "ayo_dun02",
    "mapName": "Ayothaya Dungeon 2",
    "minMinutes": 123,
    "maxMinutes": 183
  },
  {
    "bossKey": "turtle_general",
    "name": "Turtle General",
    "mapKey": "tur_dun04",
    "mapName": "Turtle Island 4",
    "minMinutes": 60,
    "maxMinutes": 72
  }
];
/** Mini-boss map/timer references are provisional, not validated against SoulBound. */
export const MINI_BOSS_SPAWNS: MvpSpawn[] = [
  {
    "bossKey": "angeling",
    "name": "Angeling",
    "mapKey": "pay_fild04",
    "mapName": "Payon Field 4",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "angeling",
    "name": "Angeling",
    "mapKey": "xmas_dun01",
    "mapName": "Toy Factory 1",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "angeling",
    "name": "Angeling",
    "mapKey": "yuno_fild03",
    "mapName": "Yuno Field 3",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "dragon_fly",
    "name": "Dragon Fly",
    "mapKey": "moc_fild18",
    "mapName": "Sograt Desert 18",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "ghostring",
    "name": "Ghostring",
    "mapKey": "pay_fild04",
    "mapName": "Payon Field 4",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "ghostring",
    "name": "Ghostring",
    "mapKey": "prt_maze03",
    "mapName": "Prontera Maze 3",
    "minMinutes": 113,
    "maxMinutes": 170,
    "kind": "mini"
  },
  {
    "bossKey": "ghostring",
    "name": "Ghostring",
    "mapKey": "treasure02",
    "mapName": "Sunken Ship 2",
    "minMinutes": 33,
    "maxMinutes": 53,
    "kind": "mini"
  },
  {
    "bossKey": "mastering",
    "name": "Mastering",
    "mapKey": "pay_fild04",
    "mapName": "Payon Field 4",
    "minMinutes": 30,
    "maxMinutes": 60,
    "kind": "mini"
  },
  {
    "bossKey": "eclipse",
    "name": "Eclipse",
    "mapKey": "prt_fild02",
    "mapName": "Prontera Field 2",
    "minMinutes": 30,
    "maxMinutes": 60,
    "kind": "mini"
  },
  {
    "bossKey": "toad",
    "name": "Toad",
    "mapKey": "gef_fild01",
    "mapName": "Geffen Field 1",
    "minMinutes": 30,
    "maxMinutes": 60,
    "kind": "mini"
  },
  {
    "bossKey": "vagabond_wolf",
    "name": "Vagabond Wolf",
    "mapKey": "prt_maze03",
    "mapName": "Prontera Maze 3",
    "minMinutes": 30,
    "maxMinutes": 60,
    "kind": "mini"
  },
  {
    "bossKey": "vocal",
    "name": "Vocal",
    "mapKey": "prt_fild07",
    "mapName": "Prontera Field 7",
    "minMinutes": 30,
    "maxMinutes": 60,
    "kind": "mini"
  },
  {
    "bossKey": "deviling",
    "name": "Deviling",
    "mapKey": "pay_fild04",
    "mapName": "Payon Field 4",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "arc_angeling",
    "name": "Arc Angeling",
    "mapKey": "yuno_fild05",
    "mapName": "Yuno Field 5",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  },
  {
    "bossKey": "maya_purple",
    "name": "Maya Purple",
    "mapKey": "anthell02",
    "mapName": "Ant Hell 2",
    "minMinutes": 60,
    "maxMinutes": 90,
    "kind": "mini"
  }
];
export const BOSS_SPAWNS: MvpSpawn[] = [...MVP_SPAWNS, ...MINI_BOSS_SPAWNS];
export const mvpSpawnId = (spawn: MvpSpawn) => `${spawn.bossKey}:${spawn.mapKey}`;
