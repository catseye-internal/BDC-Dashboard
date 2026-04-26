// ═══════════════════════════════════════════════════════════════
// BDC Dashboard — Configuration
// All business-logic constants extracted from index.html.
// Edit this file when branches, reps, territories, or API
// endpoints change — no need to touch index.html.
// ═══════════════════════════════════════════════════════════════

// ── API & Cache Endpoints ──
const API_URL   = 'https://script.google.com/macros/s/AKfycbxeTKxUYTQAre70xrSur8fUwc7bv7yqwt29kvzGDwGy7-bM7So1WlR6rIgsiKORUXe4Zg/exec';
const API_TOKEN = 'catseye-bdc-2026';

const CACHE_JSON_URL = './cache.json';
const CACHE_2025_URL = './cache-2025.json';
const CACHE_SHEET_ID = '1LoJHJ8aryr-W6O-6H4J0WL19QuBDBfEVbw-aZI1B0tg';
const CACHE_SHEET_CSV = `https://docs.google.com/spreadsheets/d/${CACHE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Cache`;

// ── Wallboard ──
const CYCLE_INTERVAL = 30000; // 30 seconds per view in wallboard mode

// ── Sales Center Branch Constants ──
const SC_CATSEYE_BRANCHES = ['Eastern Mass', 'Connecticut', 'Rhode Island'];
const SC_USX_BRANCHES     = ['USX - Western Mass', 'USX - Upstate New York'];
const SC_ALL_BRANCHES     = [...SC_CATSEYE_BRANCHES, ...SC_USX_BRANCHES];

// ── Tech Code → Inspector Name (PestPac "Leads Run" ownership) ──
const TECH_OWNER_MAP = {
  'AXK': 'Alexander Klash',
  'BAG': 'Brian Greska',
  'BCP': 'Billy Piper',
  'BES': 'Brian Santiago',
  'JJD': 'Joe Dingwall',
  'JMP': 'Jeffrey Paige',
  'JVB': 'Jacob Burgess',
  'RXP': 'Richard Pacheco',
  'VXR': 'Vincent Romano'
};

// ── Excluded Mediums (internal lines, direct dials, billing — not real leads) ──
const EXCLUDED_MEDIUMS = new Set([
  'bdc sales line',
  '518-336-3000',
  'catseye - amanda groves - ct direct dial',
  'catseye - amanda groves - ma direct dial',
  'catseye - kevin aucoin - ma direct dial (508 - 978 - 7362)',
  'catseye - megan sweet - ct direct dial',
  'catseye - sara d\'angelo - ct direct dial',
  'catseye - sara d\'angelo - ma direct dial',
  'catseye - senghor morgan - ct direct dial',
  'catseye - senghor morgan - ma direct dial',
  'kevin aucoin - ct direct dial',
  'hopkinton office direct',
  'catseye billing number',
  'connecticut : cromwell office number',
  'usa',
  'usa number',
  'usx - amanda groves - ny direct dial',
  'usx - amanda groves - ma direct dial',
  'usx - kevin aucoin - ny direct dial',
  'usx - kevin aucoin - ma direct dial',
  'usx - senghor morgan - ny direct dial',
  'usx - senghor morgan - ma direct dial',
  'usx - matt arredondo - ct direct dial',
  'usx - lisa mextorf - ma direct dial'
]);

// ── Chart Colors & Labels ──
const TYPE_COLORS = {
  'Call': '#F47B20',
  'Text': '#60A5FA',
  'Form': '#A78BFA',
  'LSA':  '#34D399',
};
const TYPE_FALLBACK = '#9CA3AF';
const TYPE_MAP = { 'CallRail': 'Call', 'Podium': 'Text', 'Webform': 'Form', 'LSA': 'LSA' };

const PERIOD_LABELS = { today: 'TODAY', yesterday: 'YESTERDAY', wk: 'WK', mtd: 'MTD', ytd: 'YTD', custom: 'CUSTOM' };

const MKTG_COLORS = {
  'LSA':      '#34D399',
  'Paid':     '#F47B20',
  'Organic':  '#60A5FA',
  'Direct':   '#FBBF24',
  'Listings': '#9CA3AF',
  'Webchat':  '#A78BFA',
  'Webform':  '#EC4899',
  'Other':    '#6B645A',
};
const MKTG_FALLBACK = '#6B645A';

// ── Territory Zip-Code Ranges ──
// USX - Upstate New York
const USX_NY_ZIP_RANGES = [
  // Albany County
  [12007,12007],[12009,12009],[12023,12023],[12041,12041],[12045,12047],[12054,12054],
  [12059,12059],[12067,12067],[12077,12077],[12084,12084],[12107,12110],[12120,12120],
  [12128,12128],[12143,12143],[12158,12161],[12183,12183],[12186,12186],[12189,12189],
  [12193,12193],[12201,12212],[12214,12214],[12220,12220],[12222,12228],[12230,12233],
  [12234,12234],[12236,12237],[12238,12242],[12243,12246],[12247,12250],[12255,12257],
  [12260,12261],
  // Rensselaer County
  [12017,12017],[12033,12033],[12040,12040],[12052,12052],[12056,12056],[12061,12061],
  [12070,12070],[12121,12121],[12138,12138],[12144,12144],[12148,12148],[12153,12154],
  [12168,12169],[12173,12173],[12175,12175],[12180,12182],[12185,12185],[12196,12196],
  // Saratoga County
  [12008,12008],[12010,12010],[12018,12020],[12065,12066],[12118,12118],[12148,12148],
  [12151,12151],[12170,12170],[12188,12188],[12803,12803],[12804,12804],[12810,12810],
  [12831,12831],[12833,12835],[12863,12863],[12866,12866],[12871,12871],
  // Warren County
  [12801,12801],[12804,12804],[12808,12808],[12810,12810],[12812,12812],[12814,12817],
  [12824,12824],[12836,12836],[12838,12838],[12842,12842],[12844,12845],[12853,12853],
  [12860,12860],[12862,12862],[12874,12874],[12878,12878],[12884,12887],
  // Washington County
  [12809,12809],[12811,12811],[12816,12816],[12819,12823],[12827,12828],[12832,12832],
  [12834,12834],[12837,12837],[12839,12839],[12841,12841],[12843,12843],[12846,12846],
  [12848,12849],[12857,12857],[12861,12861],[12865,12865],[12868,12868],[12870,12871],
  [12873,12873],[12879,12879],[12883,12883],[12887,12887],
  // Schenectady County
  [12054,12054],[12137,12137],[12141,12141],[12147,12148],[12150,12150],[12157,12157],
  [12301,12309],[12325,12325],[12345,12345],
  // Montgomery County
  [12010,12010],[12068,12068],[12070,12070],[12072,12072],[12078,12078],[12094,12095],
  [12117,12117],[12125,12125],[12134,12134],[13317,13317],[13339,13339],[13428,13428],
  [13452,13452],
  // Fulton County
  [12010,12010],[12032,12032],[12068,12068],[12070,12070],[12072,12072],[12078,12078],
  [12095,12095],[12117,12117],[12134,12134],[12164,12164],[13320,13320],[13329,13329],
  [13339,13339],[13452,13452],
  // Greene County
  [12051,12051],[12058,12058],[12064,12064],[12076,12076],[12083,12083],[12087,12087],
  [12174,12174],[12176,12176],[12192,12192],[12405,12405],[12407,12407],[12411,12411],
  [12414,12414],[12418,12418],[12422,12422],[12427,12427],[12431,12431],[12436,12436],
  [12439,12439],[12442,12442],[12444,12444],[12451,12451],[12463,12463],[12468,12468],
  [12482,12482],[12492,12492],
  // Columbia County
  [12015,12016],[12024,12024],[12029,12029],[12037,12037],[12042,12042],[12050,12050],
  [12060,12060],[12062,12062],[12075,12075],[12106,12106],[12115,12115],[12125,12125],
  [12130,12130],[12132,12132],[12136,12136],[12165,12165],[12172,12174],[12184,12184],
  [12195,12195],[12502,12502],[12513,12513],[12516,12517],[12521,12523],[12526,12526],
  [12529,12529],[12534,12534],[12544,12544],[12565,12565],
  // Dutchess County
  [12501,12501],[12503,12504],[12506,12508],[12510,12512],[12514,12514],[12522,12522],
  [12524,12524],[12527,12527],[12531,12533],[12537,12538],[12540,12540],[12545,12546],
  [12564,12564],[12567,12567],[12569,12572],[12574,12575],[12578,12578],[12580,12581],
  [12583,12583],[12585,12585],[12590,12594],[12601,12604],
  // Ulster County
  [12401,12401],[12404,12404],[12406,12406],[12409,12412],[12416,12417],[12419,12420],
  [12428,12430],[12432,12434],[12440,12441],[12443,12443],[12446,12449],[12456,12458],
  [12461,12461],[12464,12466],[12471,12473],[12477,12477],[12480,12481],[12484,12484],
  [12486,12487],[12489,12491],[12493,12495],[12498,12498],[12515,12515],[12525,12525],
  [12528,12528],[12550,12550],[12561,12561],[12566,12566],
];

// USX - Western Mass
const USX_WMASS_ZIP_RANGES = [
  // Berkshire County
  [1201,1201],[1220,1220],[1222,1227],[1229,1230],[1235,1240],[1242,1242],
  [1244,1245],[1247,1247],[1252,1253],[1255,1259],[1262,1264],[1266,1267],[1270,1270],
  // Franklin County
  [1301,1301],[1330,1331],[1337,1342],[1344,1344],[1346,1347],[1349,1351],
  [1354,1355],[1360,1360],[1364,1364],[1366,1368],[1370,1370],[1373,1376],
  [1378,1380],
  // Hampshire County
  [1002,1003],[1007,1007],[1010,1012],[1026,1027],[1032,1033],[1035,1035],
  [1038,1039],[1050,1050],[1053,1054],[1059,1060],[1062,1063],[1066,1066],
  [1070,1070],[1072,1073],[1075,1075],[1080,1082],[1084,1085],[1093,1093],
  // Hampden County
  [1001,1001],[1005,1005],[1008,1009],[1013,1014],[1020,1022],[1028,1030],
  [1034,1034],[1036,1036],[1040,1040],[1050,1050],[1056,1057],[1069,1069],
  [1071,1071],[1077,1077],[1079,1079],[1085,1086],[1088,1090],[1095,1095],
  [1101,1109],[1111,1111],[1115,1116],[1118,1119],[1128,1129],[1133,1133],
  [1138,1139],[1144,1144],[1151,1152],[1195,1195],[1199,1199],
];

const USX_ZIP_RANGES = [...USX_NY_ZIP_RANGES, ...USX_WMASS_ZIP_RANGES];

// Southern NH (south of Concord — mapped to Eastern Mass)
const NH_ZIP_RANGES = [
  // Hillsborough County
  [3031,3031],[3033,3033],[3038,3038],[3043,3043],[3045,3045],[3048,3049],
  [3051,3051],[3054,3055],[3057,3057],[3060,3064],[3070,3071],[3076,3076],
  [3082,3082],[3084,3084],[3086,3087],[3101,3111],
  // Rockingham County
  [3032,3032],[3034,3034],[3036,3036],[3038,3038],[3040,3042],[3044,3044],
  [3053,3053],[3073,3074],[3077,3077],[3079,3079],[3087,3087],[3801,3801],
  [3802,3803],[3805,3805],[3809,3809],[3811,3811],[3819,3819],[3826,3827],
  [3833,3833],[3840,3842],[3844,3844],[3848,3848],[3856,3858],[3862,3862],
  [3865,3865],[3867,3870],[3873,3874],[3878,3878],[3884,3887],[3901,3901],
  // Cheshire County
  [3431,3431],[3435,3435],[3440,3441],[3443,3443],[3445,3445],[3447,3448],
  [3450,3452],[3455,3458],[3461,3462],[3464,3470],
  // Strafford County
  [3820,3820],[3823,3825],[3830,3830],[3835,3835],[3838,3839],[3843,3843],
  [3849,3851],[3853,3853],[3855,3855],[3861,3861],[3866,3868],[3878,3878],
  // Southern Merrimack (south of Concord)
  [3034,3034],[3038,3038],[3044,3044],[3046,3046],[3048,3048],[3054,3054],
  [3057,3057],[3060,3060],[3076,3076],[3079,3079],[3087,3087],[3229,3229],
  [3234,3234],[3242,3242],[3244,3244],[3253,3253],[3255,3258],[3261,3261],
  [3275,3275],[3278,3278],[3281,3281],[3290,3290],
];

// CT — all of Connecticut
const CT_ZIP_RANGES = [[6001,6389],[6401,6498],[6501,6928]];

// RI — all of Rhode Island
const RI_ZIP_RANGES = [[2801,2841],[2852,2896],[2898,2898],[2901,2921],[2940,2940]];

// ── Area Code → Territory (fallback when zip is unavailable) ──
const AREA_CODE_MAP = {
  // Eastern Mass (includes former NH)
  '617': 'Eastern Mass', '508': 'Eastern Mass', '781': 'Eastern Mass',
  '978': 'Eastern Mass', '339': 'Eastern Mass', '351': 'Eastern Mass',
  '774': 'Eastern Mass', '857': 'Eastern Mass',
  '603': 'Eastern Mass', // NH merged into Eastern Mass
  // USX - Western Mass
  '413': 'USX - Western Mass',
  // Connecticut
  '203': 'Connecticut', '860': 'Connecticut', '475': 'Connecticut', '959': 'Connecticut',
  // Rhode Island
  '401': 'Rhode Island',
  // USX - Upstate New York
  '518': 'USX - Upstate New York', '845': 'USX - Upstate New York', '914': 'USX - Upstate New York',
  '315': 'USX - Upstate New York', '585': 'USX - Upstate New York', '607': 'USX - Upstate New York',
};
