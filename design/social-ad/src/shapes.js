// Hand-authored line drawings, in frame pixels (1080×1920).
//
// FIG_TENSE and FIG_RELAX share one anchor structure, so the shoulders can
// drop point for point on a spring:
//   0–6   left arm → left shoulder → neck
//   7–19  head, with a hair-bun knot on top
//   20–26 neck → right shoulder → right arm
// The reclining figure is reached by travelling: the seated figure, an
// off-screen link and FIG_PRONE form one path, and a window slides along it.

// Seated, seen from behind — shoulders hunched up to the ears, neck gone.
export const FIG_TENSE = [
  [304, 1990], [300, 1720], [306, 1440], [334, 1214], [380, 1150], [436, 1118], [480, 1102],
  [490, 1078], [452, 1026], [440, 952], [462, 880], [512, 846], [500, 806], [540, 776],
  [580, 806], [566, 846], [618, 880], [640, 952], [628, 1026], [590, 1078],
  [600, 1102], [644, 1118], [700, 1150], [746, 1214], [774, 1440], [780, 1720], [776, 1990],
];

// The same figure, shoulders dropped and neck long again.
export const FIG_RELAX = [
  [286, 1990], [280, 1740], [282, 1500], [306, 1360], [360, 1296], [430, 1250], [476, 1210],
  [488, 1092], [452, 1030], [440, 952], [462, 878], [512, 842], [500, 802], [540, 772],
  [580, 802], [566, 842], [618, 878], [640, 952], [628, 1030], [592, 1092],
  [604, 1210], [650, 1250], [720, 1296], [774, 1360], [798, 1500], [800, 1740], [794, 1990],
];

// A short spine below the nape, so the silhouette reads as a back.
export const SPINE = [[540, 1268], [536, 1380], [541, 1490], [538, 1600]];

// Which anchors carry the tension tremor (shoulders, neck).
export const TREMOR = [0, 0.2, 0.6, 1, 1, 1, 0.8, 0.4, 0.15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.4, 0.8, 1, 1, 1, 0.6, 0.2, 0];

// Lying face-down on the table, head turned to camera, hair in a bun —
// laid over assets/photos/band-stones.jpg as placed in the band (y 862–1368)
// so the drawing hands over to the photograph. Drawn from the right: the
// table line, round the back of the head and the bun, then along the back.
export const FIG_PRONE = [
  [1150, 1344], [920, 1346], [680, 1342], [470, 1334], [290, 1324], [130, 1306],
  [46, 1258], [12, 1160], [26, 1060], [76, 990],
  [122, 962], [100, 922], [138, 894], [180, 914], [164, 954],
  [226, 964], [282, 984], [314, 1010], [343, 1006], [374, 984], [420, 962],
  [500, 940], [610, 926], [720, 920], [830, 914], [900, 880], [1150, 820],
];

// Off-screen run (bottom-right) that joins the seated figure's last stroke
// to the reclining figure's first, so one line can travel through both.
export const SNAKE_LINK = [[794, 1990], [930, 2080], [1190, 1930], [1230, 1620], [1150, 1344]];

// Sleeping eye and brow, drawn in after she settles.
export const PRONE_EYE = [[222, 1196], [238, 1206], [258, 1209], [278, 1203]];
export const PRONE_BROW = [[214, 1158], [236, 1150], [262, 1150], [284, 1160]];

// The four basalt stones on her back — measured from the photo, so the
// drawn stones land exactly where the real ones are when it develops.
export const STONES = [
  { x: 424, y: 1015, rx: 59, ry: 37, rot: -0.38 },
  { x: 566, y: 953, rx: 56, ry: 35, rot: -0.14 },
  { x: 716, y: 956, rx: 46, ry: 21, rot: 0.09 },
  { x: 843, y: 964, rx: 43, ry: 22, rot: 0.05 },
];

// Band placement of band-stones.jpg (1280×600 source).
export const BAND = { y: 862, h: 506, scale: 1080 / 1280 };

// Stack plate landmarks (stack.jpg, frame px).
export const STACK = { flame: [258, 790], topStone: [640, 1152] };

// Aroma plate (aroma.jpg is 1626 wide; frame shows x 0..1080 before the pan).
export const AROMA = { flame: [560, 849] };

// Studio plate: the real arched mirror, seen in perspective. GLASS traces the
// inner edge of the glass (measured on assets/photos/studio.jpg); the line
// draws up the left side, over the arch, and down the right.
export const GLASS = [
  [611, 826], [611, 700], [612, 600], [615, 518], [620, 474], [634, 430], [657, 389],
  [691, 355], [733, 331], [785, 318], [838, 320], [884, 337], [921, 366], [946, 403],
  [961, 448], [969, 500], [972, 562], [971, 660], [967, 760], [962, 840],
];
export const GLASS_CENTER = [790, 590];
