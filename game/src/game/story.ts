/**
 * The five nights and everything anyone says. Names and wording are placeholders for Keith to correct.
 */
export type Line = { who: string; text: string };
export type ErrandId = "water" | "lana" | "hilot" | "kapre" | "legs";
export type Form = "foot" | "air";

export const NIGHTS: { name: string; seconds: number; form: Form; errand: ErrandId; errandAt: number; daySeconds: number }[] = [
  { name: "The first watch", seconds: 230, form: "foot", errand: "water", errandAt: 50, daySeconds: 110 },
  { name: "The roof", seconds: 260, form: "air", errand: "lana", errandAt: 45, daySeconds: 150 },
  { name: "The trail", seconds: 300, form: "foot", errand: "hilot", errandAt: 14, daySeconds: 150 },
  { name: "The balete", seconds: 300, form: "air", errand: "kapre", errandAt: 14, daySeconds: 150 },
  { name: "The birth", seconds: 360, form: "air", errand: "legs", errandAt: 30, daySeconds: 160 },
];

/** What the errand asks for at each step. The last step of most is to come home. */
export const ERRANDS: Record<ErrandId, { title: string; steps: string[] }> = {
  water: { title: "Water for Rosing", steps: ["Draw water at the well in the middle of the barrio.", "Carry the water back to Rosing's door."] },
  lana: { title: "The albularyo's oil", steps: ["Go to Nong Kadyo's hut, north-east past the well, and ask for the oil.", "Bring the oil home to Rosing."] },
  hilot: { title: "Call the hilot", steps: ["Take the trail east to the old sitio and call up to the hilot's lit house.", "Go home."] },
  kapre: { title: "The one in the balete", steps: ["Leave tobacco at the roots of the balete, north-west. Walk. Do not run.", "Find what she left standing near the tree.", "Go home."] },
  legs: { title: "End it", steps: ["She has taken to the air. Find where she hid her legs and salt them before cockcrow."] },
};

export const INTRO: Line[] = [
  { who: "", text: "Visayas, 1953. Milling season. The men are in Negros, cutting cane." },
  { who: "", text: "Your sister Rosing is near her time, and her husband is one of them. So they sent for you." },
  { who: "Rosing", text: "Dong? Is that you on the path? I cannot get up. Come to the door when you are ready." },
  { who: "Rosing", text: "There is salt and garlic in the kitchen. Father always said: salt at the door, garlic at the windows, before dark." },
];

/** Rosing, heard from inside the house. `at` is seconds into the night. */
export const ROSING_NIGHT: Record<number, { at: number; text: string }[]> = {
  1: [
    { at: 6, text: "Dong? Stay where I can hear you." },
    { at: 26, text: "Do you hear that clicking? Father used to say: when it is loud, it is far. When it is faint..." },
  ],
  2: [{ at: 8, text: "It was at the door last night. I heard it breathing." }, { at: 28, text: "Keep the fire smoking. I do not like the sound of the thatch." }],
  3: [{ at: 4, text: "Go, and come back. I will keep still and quiet." }],
  4: [{ at: 5, text: "I heard wings again before dark. Find where it comes from, Dong. End it." }],
  5: [{ at: 4, text: "It is time. The hilot is with me. Whatever happens out there, do not let it in." }, { at: 150, text: "Dong! Are you still there? Do not leave me now!" }, { at: 280, text: "Almost... almost. Hold on a little longer." }],
};
export const ROSING_ERRAND: Record<ErrandId, string> = {
  water: "I am burning, Dong. The jar is empty. Please, the well. Be quick.",
  lana: "It hurts. It is too early for this. Nong Kadyo has an oil... go to him.",
  hilot: "The hilot must know to come. Take the trail. Do not stop for anything on it.",
  kapre: "Nong Kadyo said the old one in the tree sees everything. Take it the tobacco.",
  legs: "It is in the air again. Find the legs. Salt them. Go!",
};
export const ROSING_SAYS = {
  held: (where: string) => `Something struck ${where} and drew back.`,
  trying: (where: string) => `Dong! It is at ${where}!`,
  breach: "It was inside! Dong! DONG!",
  roof: "The roof! Something is on the roof!",
  smoke: "The smoke turned it. It is gone from the roof.",
  water: "Thank you. Stay close now.",
  lana: "Keep it by you. He says it boils when one of them is near.",
  home: "You came back. Stay. Stay by the door.",
  idle: ["I am awake. I am listening.", "Is the lamp still lit?", "The child is moving. It knows.", "Do not go far."],
};

/** Nang Pacing, by day. Indexed by the night that follows. */
export const PACING_DAY: Record<number, Line[]> = {
  1: [
    { who: "Nang Pacing", text: "You must be Rosing's brother. Andoy. You were this high when you left for town." },
    { who: "Nang Pacing", text: "She has been asking for you. I bring her supper most evenings; she cannot rise now." },
    { who: "Nang Pacing", text: "Keep your lamp trimmed tonight, Dong. The nights are long here." },
  ],
  2: [
    { who: "Nang Pacing", text: "The dogs were restless last night. Did you sleep?" },
    { who: "Nang Pacing", text: "Those marks on the post? A civet, surely. They come for the hens." },
    { who: "Nang Pacing", text: "I brought porridge for her. Eat, both of you." },
  ],
  3: [
    { who: "Nang Pacing", text: "You look worn through. And tonight you must go for the hilot, no? It is a long way in the dark." },
    { who: "Nang Pacing", text: "Let me sit with Rosing while you are gone. She should not be alone." },
  ],
  4: [{ who: "Nang Pacing", text: "You have a hard look this morning, Dong. Whatever you think you saw, the night plays tricks." }],
  5: [{ who: "Nang Pacing", text: "Tonight the child comes." }, { who: "Nang Pacing", text: "I will pray for her. I will be near." }],
};
export const PACING_KNOWS: Line[] = [{ who: "Nang Pacing", text: "Tonight the child comes." }, { who: "Nang Pacing", text: "So will I." }];
export const PACING_TRUSTED: Line[] = [{ who: "Nang Pacing", text: "She slept so sweetly, Dong. I barely had to touch her." }];
export const PROOF_TEXT = {
  salt: "She sets the bowl down an arm's length from the salted door, and comes no nearer.",
  oil: "The oil in the bottle at your hip begins to tremble. Then it boils.",
  skirt: "A woman's hips and legs, standing alone in the roots. You know that patadyong. You saw it at the well.",
};

/** Nong Kadyo, the albularyo, by day. Indexed by the night that follows. */
export const KADYO_DAY: Record<number, Line[]> = {
  1: [
    { who: "Nong Kadyo", text: "So. The brother. They will tell you I am the one. Let them talk. Listen instead." },
    { who: "Nong Kadyo", text: "When you hear it clicking loud, it is far. When it grows faint, it is at your shoulder." },
    { who: "Nong Kadyo", text: "Salt at the door, garlic at the windows. It tries each opening, and a protection holds once." },
    { who: "Nong Kadyo", text: "It will not stand in your lamplight. Go to where it is working and it will draw off. For a while." },
  ],
  2: [
    { who: "Nong Kadyo", text: "It could not use the door. Tonight it will come by the roof. They leave their legs standing somewhere and fly." },
    { who: "Nong Kadyo", text: "Smoke keeps them off the thatch. Feed the fire in your yard with kindling, and feed it again." },
    { who: "Nong Kadyo", text: "If it settles anyway, strike the house post. It hates the noise. Then run, because it will come for you." },
    { who: "Nong Kadyo", text: "Come to me tonight when her pains start. I will have an oil ready." },
  ],
  3: [
    { who: "Nong Kadyo", text: "The hilot lives past the trail, in the old sitio. The trail has an owner." },
    { who: "Nong Kadyo", text: "If you pass the same rag on the same post twice, stop walking. Turn your shirt inside out. Then go on." },
    { who: "Nong Kadyo", text: "It will not hurt you. It will only keep you. And you know what happens at the house while you are kept." },
    { who: "Nong Kadyo", text: "And keep off the graves there. One who was aswang and died without passing it on does not rest. Amalanhig." },
    { who: "Nong Kadyo", text: "It cannot bend, so it turns slow: step aside and run. If it gets its hands on you it tears at you, and twice is nearly enough. Three good blows of the whip will lay it down till morning." },
  ],
  4: [
    { who: "Nong Kadyo", text: "You want it ended? Find the legs. Salt on the stump and she cannot join herself again." },
    { who: "Nong Kadyo", text: "The old one in the balete sees everything. Bring it tobacco. Walk under its tree; never run. If you anger it, it will blow out your lamp and leave you blind." },
  ],
  5: [
    { who: "Nong Kadyo", text: "She will hide them somewhere new tonight. If the old one in the tree owes you, watch for its ember on the ground." },
    { who: "Nong Kadyo", text: "She keeps a thing on four legs under her floor, and tonight she will let it out. It walks backwards. It does not want you. It wants your shadow." },
    { who: "Nong Kadyo", text: "No lamp, no shadow: shutter the light and it has nothing to drink. It will not step over salt, and it fears the whip." },
    { who: "Nong Kadyo", text: "Salt them before the cock crows, and it is finished. Bring me what is left of her, after." },
  ],
};

export const ENDINGS: Record<string, { title: string; lines: string[] }> = {
  empty: { title: "THE EMPTY HOUSE", lines: ["Morning comes. The house is very quiet.", "On the path, Nang Pacing is walking toward you with a covered bowl, smiling.", "\"You must eat something, Dong.\""] },
  remains: { title: "SUNRISE", lines: ["The cock crows, and from inside the house a thin new cry answers it.", "The child is born. Rosing lives.", "Somewhere at the edge of the barrio a woman rejoins herself, and walks home.", "The barrio keeps its aswang."] },
  take: { title: "ASWANG", lines: ["She cannot die until it is passed on. You open your hands.", "Something small and black goes from her mouth to yours, and she is still at last.", "The child is safe. Rosing lives. The barrio buries a kind widow.", "That night you hear clicking, very loud, very far. It is coming from you."] },
  refuse: { title: "SUNRISE", lines: ["You step back. The light reaches her.", "She does not die. She cannot. They carry her to her house and close the door.", "The child is safe. Rosing lives.", "For years the barrio hears her at night, begging someone, anyone, to take it."] },
  sealed: { title: "THE BAMBOO TUBE", lines: ["Nong Kadyo kneels beside her with a length of green bamboo, and says the words.", "It goes from her mouth into the tube. He stops it with wax, and she closes her eyes.", "You bury it together under the balete. The old one in the tree watches, and lights a cigar.", "The child is safe. Rosing lives. The barrio sleeps."] },
};
