// Adherence/streak analytics + the role-filtered workspace view.
// Ported from server.py:240-260 (analytics) and 310-336 (view).
// viewFor() is a security boundary: it strips every other client's data and all
// coach notes from a member's response.
import { APIError } from "./http";
import { today } from "./time";
import { normalizeClients } from "./validate";

const VIDEO_URLS: Record<string, string> = {
  e0:  "https://www.youtube.com/watch?v=Yw3s1JTExkU",
  e1:  "https://www.youtube.com/watch?v=_oyxCn2iSjU",
  e2:  "https://www.youtube.com/watch?v=BYKScL2sgCs",
  e3:  "https://www.youtube.com/watch?v=zsN2WvklwDk",
  e4:  "https://www.youtube.com/watch?v=fURsHPHgssI",
  e5:  "https://www.youtube.com/watch?v=7mzKcADa46c",
  e6:  "https://www.youtube.com/watch?v=k_kJq7S4kqw",
  e7:  "https://www.youtube.com/watch?v=5VG4UnfA7Bk",
  e8:  "https://www.youtube.com/watch?v=aaiJlEOf-UE",
  e9:  "https://www.youtube.com/watch?v=WeeGZtCfJ7g",
  e10: "https://www.youtube.com/watch?v=gCW_VWcTtbw",
  e11: "https://www.youtube.com/watch?v=0M-erHBl48U",
};

type SessionExercise = { id: string; sets: string };
type SessionDef = { name: string; exercises: SessionExercise[] };

const PROGRAMME_SESSIONS: Record<string, SessionDef[]> = {
  // ax-* exercises require the Ascent library to be loaded via scripts/load-content.mjs
  p0: [
    { name: "Session A — Squat, hinge, horizontal push/pull", exercises: [
      {id:"ax-gsq",      sets:"2–3 × 6–8 · 3-1-1-0 · 90 s"},
      {id:"ax-rdl",      sets:"2–3 × 8 · 3-1-1-0 · 90 s"},
      {id:"ax-pushup",   sets:"2–3 × 6–10 · 2-1-1-0 · 75 s"},
      {id:"ax-invrow",   sets:"2–3 × 8–10 · 2-1-1-1 · 75 s"},
      {id:"ax-calfraise",sets:"2 × 10–12 · 2-1-2-1 · 60 s"},
      {id:"ax-deadbug",  sets:"2 × 6/side · slow · 45 s"},
    ]},
    { name: "Session B — Single-leg, pull, press and carry", exercises: [
      {id:"ax-splitsquat",sets:"2–3 × 8/leg · 2-1-1-0 · 75 s"},
      {id:"ax-rdl",      sets:"2–3 × 8 · 3-1-1-0 · 90 s"},
      {id:"ax-kbpress",  sets:"2–3 × 8/arm · 2-1-1-0 · 75 s"},
      {id:"e10",         sets:"2–3 × 8–10 · 2-1-1-1 · 75 s"},
      {id:"ax-farmer",   sets:"3 × 20–30 m · 60–75 s"},
      {id:"ax-sideplank",sets:"2 × 15–30 s/side · 45 s"},
    ]},
    { name: "Session C — Reinforce and integrate", exercises: [
      {id:"ax-gsq",      sets:"2–3 × 8 · 3-1-1-0 · 75 s"},
      {id:"ax-hambridge",sets:"2–3 × 8–10 · 2-1-1-0 · 75 s"},
      {id:"ax-pushup",   sets:"2–3 × 8 · 2-1-1-0 · 75 s"},
      {id:"e4",          sets:"2–3 × 10/side · 2-1-1-1 · 60 s"},
      {id:"ax-tibraise", sets:"2 × 12 · 2-1-2-1 · 60 s"},
      {id:"ax-ninety",   sets:"2 × 5/side · controlled"},
    ]},
  ],
  p1: [
    { name: "Session A — Lower / squat emphasis", exercises: [
      {id:"ax-gsq",      sets:"Main lift · wave tempo · 2–3 min"},
      {id:"ax-rdl",      sets:"3 × 6–8 · 3-0-1-0 · 2 min"},
      {id:"ax-splitsquat",sets:"2–3 × 8/leg · 2-1-1-0 · 75 s"},
      {id:"ax-calfraise",sets:"3 × 8–12 · 2-1-2-1 · 60 s"},
      {id:"ax-pallof",   sets:"2 × 10/side · 60 s"},
    ]},
    { name: "Session B — Upper / horizontal press", exercises: [
      {id:"e2",          sets:"Main lift · wave tempo · 2–3 min"},
      {id:"e10",         sets:"3 × 6–10 · 2-1-1-1 · 90 s"},
      {id:"ax-kbpress",  sets:"3 × 8 · 2-0-1-0 · 90 s"},
      {id:"ax-invrow",   sets:"3 × 8–12 · 2-1-1-1 · 75 s"},
      {id:"ax-shouldercars",sets:"2 × 12–15 · 60 s"},
    ]},
    { name: "Session C — Lower / hinge emphasis", exercises: [
      {id:"ax-rdl",      sets:"Main lift · wave tempo · 2–3 min"},
      {id:"ax-revlunge", sets:"3 × 8/leg · 2-1-1-0 · 75–90 s"},
      {id:"ax-ht",       sets:"3 × 8–10 · 2-1-1-1 · 90 s"},
      {id:"ax-tibraise", sets:"3 × 10–12 · 2-1-2-1 · 60 s"},
      {id:"ax-copenhagen",sets:"2 × 15–25 s/side · 60 s"},
    ]},
    { name: "Session D — Upper / vertical press + pull", exercises: [
      {id:"ax-ohp",      sets:"3–4 × 5–8 · 2-0-X-0 · 2 min"},
      {id:"ax-invrow",   sets:"3 × 8–10 · 2-1-1-1 · 90 s"},
      {id:"ax-pushup",   sets:"3 × 8–10 · 2-0-1-0 · 75–90 s"},
      {id:"e10",         sets:"3 × 6–10 · 2-1-1-1 · 90 s"},
      {id:"ax-suitcase", sets:"2–3 × 30 m/side · 75 s"},
    ]},
  ],
  p2: [
    { name: "Session A — Hip + ankle control", exercises: [
      {id:"ax-hipcars",  sets:"2 × 3/dir/side · slow · 30 s"},
      {id:"ax-ninety",   sets:"2 × 6/side · 3-sec transitions"},
      {id:"ax-anklerock",sets:"2 × 8/side · 2-sec end hold"},
      {id:"ax-splitsquat",sets:"2 × 20–30 s OR 2 × 8/side · 60 s"},
      {id:"ax-gsq",      sets:"2 × 8 · 3-1-1-0 · 60 s"},
    ]},
    { name: "Session B — Thoracic + shoulder control", exercises: [
      {id:"ax-catcow",   sets:"2 × 6/side · controlled"},
      {id:"ax-shouldercars",sets:"2 × 3/side · slow"},
      {id:"ax-wallslide",sets:"3 × 6–8 · 2-sec top hold"},
      {id:"ax-scappush", sets:"2 × 5–6 · 2-sec hold"},
      {id:"ax-kbpress",  sets:"2–3 × 8/side · 2-1-1-0 · 60 s"},
      {id:"ax-suitcase", sets:"3 × 20 m/side · 60 s"},
    ]},
    { name: "Session C — Integrated movement quality", exercises: [
      {id:"ax-hipcars",  sets:"5 min total · whole-body CAR sequence"},
      {id:"ax-cossack",  sets:"2 × 6/side · 3-sec lower"},
      {id:"ax-gsq",      sets:"3 × 6 · 3-2-1-0 · 75 s"},
      {id:"ax-stepdown", sets:"2 × 8/side · 3-sec lower"},
      {id:"ax-suitcase", sets:"2 × 30 m/side · 60 s"},
    ]},
  ],
  p3: [
    { name: "Session A — Aerobic development", exercises: [
      {id:"e8",          sets:"20–35 min continuous · RPE 3–4"},
      {id:"ax-hipcars",  sets:"4–5 min · easy mobility"},
      {id:"ax-calfraise",sets:"2 × 10 · optional · RPE 4–5"},
    ]},
    { name: "Session B — Controlled intervals", exercises: [
      {id:"e8",          sets:"4–5 × 2–4 min work / 2–3 min easy · RPE 7–8"},
      {id:"ax-deadbug",  sets:"2 × 8/side · light"},
      {id:"ax-sideplank",sets:"2 × 20 s/side · light"},
    ]},
    { name: "Session C — Strength-endurance circuit", exercises: [
      {id:"ax-stepup",   sets:"8–12 reps/round · RPE 5–6 · 3–4 rounds"},
      {id:"ax-farmer",   sets:"20–30 m/round · moderate"},
      {id:"ax-invrow",   sets:"10–12 reps/round · controlled"},
      {id:"e8",          sets:"2 min/round · RPE 4–5"},
      {id:"ax-pushup",   sets:"8–10 reps/round · controlled"},
    ]},
  ],
  p4: [
    { name: "Session A — Squat + horizontal push", exercises: [
      {id:"ax-gsq",      sets:"3 × 6–10 · 2-1-1-0 · 90 s"},
      {id:"ax-pushup",   sets:"3 × 6–10 · 2-0-1-0 · 90 s"},
      {id:"e4",          sets:"3 × 8–12/arm · 2-1-1-1 · 60 s"},
      {id:"ax-calfraise",sets:"2 × 10–15 · 2-1-2-0 · 45 s"},
      {id:"ax-farmer",   sets:"2 × 30 m · 60 s"},
    ]},
    { name: "Session B — Hinge + vertical push/pull", exercises: [
      {id:"ax-rdl",      sets:"3 × 6–10 · 3-0-1-0 · 90 s"},
      {id:"ax-ohp",      sets:"3 × 6–10 · 2-0-1-0 · 90 s"},
      {id:"e10",         sets:"3 × 8–12 · 2-1-1-1 · 75 s"},
      {id:"ax-splitsquat",sets:"2 × 8/leg · 2-1-1-0 · 60 s"},
      {id:"ax-sideplank",sets:"2 × 20–30 s/side · 45 s"},
    ]},
    { name: "Session C — Integrated strength", exercises: [
      {id:"ax-revlunge", sets:"3 × 8/leg · 2-1-1-0 · 75 s"},
      {id:"ax-ht",       sets:"3 × 8–10 · 2-1-1-1 · 90 s"},
      {id:"ax-pushup",   sets:"3 × 8–10 · 2-0-1-0 · 75 s"},
      {id:"ax-invrow",   sets:"3 × 10–12 · 2-1-1-1 · 75 s"},
      {id:"ax-suitcase", sets:"2 × 20–30 m/side · 60 s"},
    ]},
  ],
  p5: [
    { name: "Session A — Aerobic strength circuit", exercises: [
      {id:"e8",          sets:"40 s station · RPE 5–6 · row/bike/walk"},
      {id:"ax-gsq",      sets:"40 s station · controlled"},
      {id:"ax-invrow",   sets:"40 s station · controlled"},
      {id:"ax-farmer",   sets:"40 s station · steady steps"},
      {id:"ax-pushup",   sets:"40 s station · controlled"},
      {id:"ax-pallof",   sets:"40 s station · light · anti-rotation hold"},
    ]},
    { name: "Session B — Whole-body movement circuit", exercises: [
      {id:"ax-stepup",   sets:"40 s station · controlled"},
      {id:"ax-rdl",      sets:"40 s station · controlled"},
      {id:"ax-pushup",   sets:"40 s station · controlled"},
      {id:"ax-invrow",   sets:"40 s station · controlled"},
      {id:"ax-suitcase", sets:"40 s station · switch sides halfway"},
    ]},
  ],
  "ap-found": [
    { name: "Session A — squat, ankle and bracing", exercises: [
      {id:"ax-gsq",       sets:"3×6–8 · 3-2-1 · 90 s"},
      {id:"ax-splitsquat",sets:"3×15–30 s/side iso · 60 s"},
      {id:"ax-anklerock", sets:"2×8/side · 2-s hold · 30 s"},
      {id:"ax-deadbug",   sets:"3×6/side · 45 s"},
      {id:"ax-calfraise", sets:"2×10–12 · 2-1-2 · 60 s"},
    ]},
    { name: "Session B — hinge, shoulder and pulling control", exercises: [
      {id:"ax-rdl",      sets:"3×8 · 3-1-1 · 90 s"},
      {id:"ax-scappush", sets:"2×8–12 · 45 s"},
      {id:"ax-pushup",   sets:"3×6–10 · 2-1-1 · 75 s"},
      {id:"ax-invrow",   sets:"3×8–10 · 2-1-1 · 75 s"},
      {id:"ax-sideplank",sets:"2×15–30 s/side · 45 s"},
    ]},
    { name: "Session C — integrated range and carrying", exercises: [
      {id:"ax-stepdown",  sets:"3×5–8/side · 3-1-1 · 60 s"},
      {id:"ax-gsq",       sets:"2×6 · 3-3-1 bottom pause · 75 s"},
      {id:"ax-ninety",    sets:"2×5/side active lift · 30 s"},
      {id:"ax-suitcase",  sets:"3×20–30 m/side · 60 s"},
      {id:"ax-hollow",    sets:"3×15–25 s · 45 s"},
    ]},
  ],
  "ap-tendon": [
    { name: "Session A — calf/soleus and supported knee load", exercises: [
      {id:"ax-calfraise",sets:"3×20–30 s iso or 3×8 · slow · 75 s"},
      {id:"ax-tibraise", sets:"3×10–12 · 3-1-2 · 75 s"},
      {id:"ax-span",     sets:"3×20–30 s hold or 3×8 · 90 s"},
      {id:"ax-stepdown", sets:"2×6/side · 3-1-1 · 60 s"},
      {id:"ax-pallof",   sets:"2×10/side · 45 s"},
    ]},
    { name: "Session B — posterior chain and adductors", exercises: [
      {id:"ax-rdl",       sets:"3×6–8 · 3-1-1 · 2 min"},
      {id:"ax-hambridge", sets:"3×8–10 or 20-s holds · 75 s"},
      {id:"ax-slidercurl",sets:"2×5–6 bilateral · 3-s return · 90 s"},
      {id:"ax-copenhagen",sets:"3×20 s/side · 60 s"},
      {id:"ax-suitcase",  sets:"2×20–30 m/side · 60 s"},
    ]},
    { name: "Session C — strength integration", exercises: [
      {id:"ax-splitsquat",sets:"2×6–8/side · 3-1-1 · 75 s"},
      {id:"ax-calfraise", sets:"2×10 easy · 2-1-2 · 60 s"},
      {id:"ax-ht",        sets:"2×10 · 2-1-1 · 75 s"},
      {id:"ax-latlunge",  sets:"2×6/side · 60 s"},
      {id:"ax-deadbug",   sets:"2×6/side + gentle hip CARs · easy"},
    ]},
  ],
  "ap-platform": [
    { name: "Session A — full-body strength-endurance", exercises: [
      {id:"ax-gsq",    sets:"3×10–12 · 2-1-1 · 75 s"},
      {id:"ax-rdl",    sets:"3×10 · 3-0-1 · 75 s"},
      {id:"ax-pushup", sets:"3×8–12 · 60 s"},
      {id:"ax-invrow", sets:"3×10–12 · 60 s"},
      {id:"ax-farmer", sets:"3×30 m · 60 s"},
      {id:"ax-deadbug",sets:"2×8/side · 45 s"},
    ]},
    { name: "Session B — low-intensity aerobic + movement skill", exercises: [
      {id:"e8",          sets:"20–35 min · RPE 3–4"},
      {id:"ax-hipcars",  sets:"2×3/side · easy"},
      {id:"ax-calfraise",sets:"2×10–15 · 45 s"},
      {id:"ax-bearcrawl",sets:"2×10 m · 60 s"},
    ]},
    { name: "Session C — measured density circuit", exercises: [
      {id:"ax-swing",   sets:"8–12/round · 3–4 rounds · 90–120 s rest between rounds"},
      {id:"ax-stepup",  sets:"8/side per round · stable knee"},
      {id:"ax-invrow",  sets:"10/round · full reach"},
      {id:"ax-suitcase",sets:"20 m/side per round"},
      {id:"e8",         sets:"90 s · RPE 5–6"},
    ]},
  ],
  "ap-triphasic": [
    { name: "Session A — squat emphasis", exercises: [
      {id:"ax-frontsquat",sets:"4×4–5 · weekly wave tempo · 3 min"},
      {id:"ax-rdl",       sets:"3×6–8 · 3-1-1 · 2 min"},
      {id:"ax-splitsquat",sets:"2×8/side · 2-1-1 · 75 s"},
      {id:"ax-calfraise", sets:"2×10 · 2-1-2 · 60 s"},
      {id:"ax-pallof",    sets:"2×10/side · 45 s"},
    ]},
    { name: "Session B — upper-body strength", exercises: [
      {id:"e2",         sets:"4×4–5 · weekly wave tempo · 2–3 min"},
      {id:"ax-pullup",  sets:"4×6–8 · 2-1-1 · 90 s"},
      {id:"ax-kbpress", sets:"3×6–8/side · 2-0-1 · 90 s"},
      {id:"ax-invrow",  sets:"3×8–10 · 2-1-1 · 75 s"},
      {id:"ax-scappush",sets:"2×15–20 s hold or 10 reps · 60 s"},
    ]},
    { name: "Session C — hinge and force expression", exercises: [
      {id:"ax-tbdl",      sets:"3×4 · 2-0-X intent · 3 min"},
      {id:"ax-gsq",       sets:"2×6 · weekly wave · 90 s"},
      {id:"ax-swing",     sets:"4×6 · 75 s"},
      {id:"ax-invrow",    sets:"3×8 · 75 s"},
      {id:"ax-copenhagen",sets:"2×15–20 s/side · 60 s"},
    ]},
  ],
  "ap-power": [
    { name: "Session A — first-step acceleration", exercises: [
      {id:"ax-accel",     sets:"4×10 m falling/2-pt start · 2–3 min"},
      {id:"ax-accel",     sets:"2–4×15–20 m build-up · 2–4 min"},
      {id:"ax-pogo",      sets:"2×8 contacts · 60–90 s"},
      {id:"ax-broad",     sets:"3×2 stick landing · 90–120 s"},
      {id:"ax-splitsquat",sets:"2×5/side · RPE 6–7 · 2 min"},
    ]},
    { name: "Session B — easy movement and deceleration", exercises: [
      {id:"e8",           sets:"15–20 min · RPE 3–4"},
      {id:"ax-askip",     sets:"3×15 m A-march · walk-back"},
      {id:"ax-accel",     sets:"4×5–8 m planned deceleration to stop · 60–90 s"},
      {id:"ax-latbound",  sets:"4×8–10 s mirror shuffle · 90 s"},
      {id:"ax-calfraise", sets:"2×8 maintenance · 60 s"},
    ]},
    { name: "Session C — strength-power integration", exercises: [
      {id:"ax-accel",     sets:"3×10–20 m build-up · full recovery"},
      {id:"ax-jumpsquat", sets:"3×3 trap-bar jump or jump squat · 2 min"},
      {id:"ax-tbdl",      sets:"3×3 · RPE 6–7 · fast intent · 2.5 min"},
      {id:"ax-mbslam",    sets:"3×3–4 med-ball throw · 90 s"},
      {id:"ax-latbound",  sets:"2×3/side lateral bound-to-stick · 90 s"},
    ]},
  ],
  "ap-kb": [
    { name: "Session A — hinge snap and squat tension", exercises: [
      {id:"ax-swing",   sets:"8–10 sets × 8–10 swings · 45–75 s"},
      {id:"ax-gsq",     sets:"4×5–6 · 3-1-1 · 90 s"},
      {id:"ax-invrow",  sets:"3×8/side · 75 s"},
      {id:"ax-suitcase",sets:"3×20–30 m/side · 60 s"},
      {id:"ax-deadbug", sets:"2×6/side · 45 s"},
    ]},
    { name: "Session B — press strength and get-up subskills", exercises: [
      {id:"ax-kbpress",     sets:"5×3–5/side · 90 s"},
      {id:"ax-tgu",         sets:"3×1/side staged or full · 90–120 s"},
      {id:"ax-revlunge",    sets:"3×6/side · 90 s"},
      {id:"ax-pullup",      sets:"3×6–10 assisted/band · 75 s"},
      {id:"ax-shouldercars",sets:"2×3/side · easy"},
    ]},
    { name: "Session C — clean, hinge and combined skill", exercises: [
      {id:"ax-kbcp",    sets:"5×3/side · 90 s"},
      {id:"ax-swing",   sets:"6×10 · 60 s"},
      {id:"ax-gsq",     sets:"3×6 · 2-s pause · 75 s"},
      {id:"ax-pushup",  sets:"3×6–10 · 75 s"},
      {id:"ax-farmer",  sets:"3×30 m · 75 s"},
    ]},
  ],
  "ap-exstr": [
    { name: "Session A — lower squat", exercises: [
      {id:"ax-gsq",     sets:"3×6–10 · RPE 6–8 · 90 s"},
      {id:"ax-rdl",     sets:"3×8–10 · 75 s"},
      {id:"ax-suitcase",sets:"2×20 m/side · 45 s"},
    ]},
    { name: "Session B — upper press/pull", exercises: [
      {id:"ax-pushup",   sets:"3×6–10 · 75–90 s"},
      {id:"ax-invrow",   sets:"3×8–12 · 75 s"},
      {id:"ax-sideplank",sets:"2×20–30 s/side · 30 s"},
    ]},
    { name: "Session C — lower single-leg/posterior", exercises: [
      {id:"ax-splitsquat",sets:"3×6–8/side · 75 s"},
      {id:"ax-ht",        sets:"3×8–10 · 90 s"},
      {id:"ax-calfraise", sets:"2×10–15 · 45 s"},
    ]},
    { name: "Session D — upper vertical + carry", exercises: [
      {id:"ax-ohp",    sets:"3×6–10 · 90 s"},
      {id:"ax-pullup", sets:"3×8–10 assisted · 75–90 s"},
      {id:"ax-farmer", sets:"2×30 m or pallof 2×10/side · 45 s"},
    ]},
  ],
  "ap-excon": [
    { name: "Session A — easy engine", exercises: [
      {id:"e8",  sets:"15–22 min · RPE 3–4 · conversational pace"},
    ]},
    { name: "Session B — controlled intervals", exercises: [
      {id:"e8",  sets:"4–6×1–2 min · RPE 7–8 · 1–2 min easy recovery between"},
    ]},
    { name: "Session C — 15-minute quality circuit", exercises: [
      {id:"ax-gsq",    sets:"8–10/round · RPE ~6"},
      {id:"ax-invrow", sets:"10/round · full reach"},
      {id:"ax-pushup", sets:"8–10/round"},
      {id:"ax-farmer", sets:"20–30 m per round"},
      {id:"e8",        sets:"60 s march/bike · RPE 5–6"},
    ]},
  ],
  "ap-mobility": [
    { name: "Session A — hip and ankle ownership", exercises: [
      {id:"ax-hipcars",   sets:"2×3/side · slow"},
      {id:"ax-ninety",    sets:"2×6/side · 3-s transition · switches"},
      {id:"ax-ninety",    sets:"3×3–5/side · 2-s holds · active lift-offs"},
      {id:"ax-anklerock", sets:"2×8/side · 2-s end hold"},
      {id:"ax-splitsquat",sets:"2×20–30 s hold or 2×6 · 60 s"},
      {id:"ax-gsq",       sets:"2×6 · 3-2-1"},
    ]},
    { name: "Session B — spine and shoulder ownership", exercises: [
      {id:"ax-catcow",      sets:"2×6/side thoracic rotation · smooth"},
      {id:"ax-shouldercars",sets:"2×3/side · slow"},
      {id:"ax-wallslide",   sets:"3×6–8 · 2-s top hold"},
      {id:"ax-scappush",    sets:"3×4/side shoulder lift-off · 2-s hold"},
      {id:"ax-kbpress",     sets:"2×8/side · 75 s"},
      {id:"ax-suitcase",    sets:"2×25 m/side · 60 s"},
    ]},
    { name: "Session C — hamstrings, adductors and integration", exercises: [
      {id:"ax-ninety",     sets:"2×6/side active SLR · 2-s hold"},
      {id:"ax-hambridge",  sets:"2×(10-s stretch + 3-s contraction)/side · optional CR"},
      {id:"ax-cossack",    sets:"2×6/side · 3-s lower"},
      {id:"ax-copenhagen", sets:"2×20 s · 45 s"},
      {id:"ax-stepdown",   sets:"2×6/side · 3-s lower"},
      {id:"ax-ninety",     sets:"2×4/side · 2-s hold · lift-off"},
    ]},
  ],
  "ap-superjoints": [
    { name: "Sequence A — neck, shoulders, wrists, thoracic", exercises: [
      {id:"ax-neck3plane",   sets:"3–5 each plane · gentle"},
      {id:"ax-shouldercars", sets:"3–5/side · stable ribs"},
      {id:"ax-elbowcircles", sets:"5 each direction"},
      {id:"ax-catcow",       sets:"5/side · thoracic open-book"},
      {id:"ax-wallslide",    sets:"6 reps · 2-s top hold"},
    ]},
    { name: "Sequence B — hips, knees, ankles, squat", exercises: [
      {id:"e8",              sets:"60 s · gentle march"},
      {id:"ax-hipcars",      sets:"3–5/side · no pelvic hiking"},
      {id:"ax-kneecircles",  sets:"6/side · comfortable arc"},
      {id:"ax-anklecircles", sets:"5 circles + 6 rocks/side"},
      {id:"ax-ninety",       sets:"5/side · hip switch"},
      {id:"ax-deepsquat",    sets:"5 reps or 20-s hold · personal range"},
    ]},
  ],
  "ap-hs1": [
    { name: "Session A — line and supported inversion", exercises: [
      {id:"ax-hollow",   sets:"3×15–25 s · 45 s"},
      {id:"ax-c2wall",   sets:"4×10–25 s · 90 s"},
      {id:"ax-scappull", sets:"3×6–8 · 60 s"},
      {id:"ax-wallwalk", sets:"2×2–3 reps · 90 s"},
      {id:"ax-wristprep",sets:"2 min recovery · easy"},
    ]},
    { name: "Session B — straight-line push strength", exercises: [
      {id:"ax-pikepush", sets:"3×5–8 elevated · 90 s"},
      {id:"ax-pushup",   sets:"3×6–10 incline · 75 s"},
      {id:"ax-archhold", sets:"2×15–20 s · 45 s"},
      {id:"ax-invrow",   sets:"3×8–10 · 75 s"},
    ]},
    { name: "Session C — entrances, exits and capacity", exercises: [
      {id:"ax-kickup",  sets:"4–8 attempts · 30–60 s"},
      {id:"ax-c2wall",  sets:"4×10–25 s · 90 s"},
      {id:"ax-wallwalk",sets:"2×2–3 reps · 90 s"},
      {id:"ax-hollow",  sets:"2×6/side dead bug or 20-s hollow · 45 s"},
    ]},
  ],
  "ap-hs2": [
    { name: "Session A — find the balance point", exercises: [
      {id:"ax-c2wall",  sets:"3×20–30 s · 90 s"},
      {id:"ax-b2wall",  sets:"5×2–4 heel pulls · 60–90 s"},
      {id:"ax-b2wall",  sets:"3×3–5 toe pulls · 60 s"},
      {id:"ax-kickup",  sets:"8–12 attempts · 30–60 s"},
      {id:"ax-invrow",  sets:"2×10 · 60 s"},
    ]},
    { name: "Session B — press strength", exercises: [
      {id:"ax-pikepush", sets:"3×5–8 elevated · 2 min"},
      {id:"ax-wallhspu", sets:"2×2–3 partial eccentric · 2 min"},
      {id:"ax-invrow",   sets:"3×6–10 · 90 s"},
      {id:"ax-hollow",   sets:"3×20–30 s · 45 s"},
      {id:"ax-wristprep",sets:"3 min · easy"},
    ]},
    { name: "Session C — clean attempts and catch quality", exercises: [
      {id:"ax-kickup",      sets:"10–15 attempts · 30–60 s"},
      {id:"ax-freehs",      sets:"6–10 short attempts · full reset"},
      {id:"ax-b2wall",      sets:"3×2 heel pull calibration · 60–90 s"},
      {id:"ax-c2wall",      sets:"2×20 s box pike weight shift · 60 s"},
      {id:"ax-shouldercars",sets:"3–4 min · easy mobility"},
    ]},
  ],
  "ap-hs3": [
    { name: "Session A — freestanding control", exercises: [
      {id:"ax-freehs",sets:"8–12 attempts · 60–120 s"},
      {id:"ax-freehs",sets:"3×2–3 shape drills tuck/straddle · 90 s"},
      {id:"ax-kickup", sets:"3×2/side controlled exit · 60 s"},
      {id:"ax-c2wall", sets:"2×20 s line reset · 90 s"},
      {id:"ax-invrow", sets:"2×10 scap reach · 60 s"},
    ]},
    { name: "Session B — press strength emphasis", exercises: [
      {id:"ax-wallhspu", sets:"4×3–6 deficit pike or partial HSPU · 2–3 min"},
      {id:"ax-pullup",   sets:"3×5–8 · 90–120 s"},
      {id:"ax-lsit",     sets:"3×6–10 compression · 60 s"},
      {id:"ax-wristprep",sets:"3 min · easy"},
    ]},
    { name: "Session C — press entry and line integration", exercises: [
      {id:"ax-straddlepress",sets:"4×2–4 straddle compression · 2 min"},
      {id:"ax-pikepress",    sets:"3×2–4 box-assisted press-to-HS · 2 min"},
      {id:"ax-freehs",       sets:"6–10 freestanding attempts · 60–120 s"},
      {id:"ax-support",      sets:"2×10–15 s parallette support · 90 s"},
      {id:"ax-shouldercars", sets:"5 min active mobility · easy"},
    ]},
  ],
  "ap-gym1": [
    { name: "Session A — hollow/arch and horizontal strength", exercises: [
      {id:"ax-hollow",  sets:"3×15–25 s · 45 s"},
      {id:"ax-archhold",sets:"3×15–20 s · 45 s"},
      {id:"ax-pushup",  sets:"3×6–10 · 75 s"},
      {id:"ax-invrow",  sets:"3×6–10 · 75 s"},
      {id:"ax-lsit",    sets:"3×10–15 s tuck L-sit · 75 s"},
    ]},
    { name: "Session B — vertical scapular strength and support", exercises: [
      {id:"ax-pullup",  sets:"4×10–20 s active hang · 75 s"},
      {id:"ax-scappull",sets:"3×5–8 scap pull-up · 75 s"},
      {id:"ax-support", sets:"4×10–20 s bar/ring support · 75 s"},
      {id:"ax-pullup",  sets:"3×6–10 assisted pull-up · 90 s"},
      {id:"ax-hollow",  sets:"2×6/side dead bug · 45 s"},
    ]},
    { name: "Session C — integrated strength and control", exercises: [
      {id:"ax-lsit",    sets:"4×8–15 s tuck L-sit · 75 s"},
      {id:"ax-pushup",  sets:"3×8 · 75 s"},
      {id:"ax-invrow",  sets:"3×8–10 · 75 s"},
      {id:"ax-c2wall",  sets:"3×15–20 s pike shoulder shift · 75 s"},
      {id:"ax-suitcase",sets:"2×25 m · 60 s"},
    ]},
  ],
  "ap-gym2": [
    { name: "Session A — straight-arm pull and horizontal support", exercises: [
      {id:"ax-fl",      sets:"4×6–12 s tuck FL iso · 2 min"},
      {id:"ax-flrow",   sets:"3×4–6 FL tuck rows · 2 min"},
      {id:"ax-pullup",  sets:"3×5–8 · 2 min"},
      {id:"ax-hollow",  sets:"2×20–30 s · 45 s"},
      {id:"ax-scappull",sets:"2×10 straight-arm pulldown · 60 s"},
    ]},
    { name: "Session B — planche lean and pushing strength", exercises: [
      {id:"ax-planchelean",sets:"4×8–12 s · 2 min"},
      {id:"ax-ppp",        sets:"3×4–6 pseudo-planche push-up · 2 min"},
      {id:"ax-support",    sets:"3×15–25 s parallel support · 90 s"},
      {id:"ax-ringdip",    sets:"3×5–8 dip or deep push-up · 90 s"},
      {id:"ax-scappull",   sets:"2×12 scap row · 60 s"},
    ]},
    { name: "Session C — L-sit, balanced push/pull", exercises: [
      {id:"ax-lsit",       sets:"5×8–15 s tuck → one-leg · 90 s"},
      {id:"ax-invrow",     sets:"3×8–10 · 75 s"},
      {id:"ax-pikepush",   sets:"3×5–8 pike push-up · 90 s"},
      {id:"ax-planchelean",sets:"2×8 s alternate lever/planche · 90 s"},
      {id:"ax-lsit",       sets:"3×8 compression · 60 s"},
    ]},
  ],
  "ap-gym3": [
    { name: "Session A — lever pulling focus", exercises: [
      {id:"ax-advtuckfl",sets:"4×6–10 s · 2–3 min"},
      {id:"ax-flrow",    sets:"3×4–6 · 2 min"},
      {id:"ax-pullup",   sets:"3×4–6 weighted/assisted · 2 min"},
      {id:"ax-invrow",   sets:"2×8–10 ring row · 75 s"},
      {id:"ax-hollow",   sets:"2×20 s · 60 s"},
    ]},
    { name: "Session B — planche pushing focus", exercises: [
      {id:"ax-tuckplanche",sets:"4×6–10 s assisted tuck planche · 2–3 min"},
      {id:"ax-ppp",        sets:"3×4–6 · 2 min"},
      {id:"ax-ringdip",    sets:"3×5–8 parallel dip · 2 min"},
      {id:"ax-ringsupport",sets:"3×10–20 s ring support · 90 s"},
      {id:"ax-invrow",     sets:"2×12 band row · 60 s"},
    ]},
    { name: "Session C — skills and supplemental strength", exercises: [
      {id:"ax-lsit",        sets:"4×10–20 s · 90 s"},
      {id:"ax-fl",          sets:"2×6–8 s easier lever · 90 s"},
      {id:"ax-ringdip",     sets:"3×6–8 ring push-up or dip · 90 s"},
      {id:"ax-pullup",      sets:"3×6–8 chin-up · 90 s"},
      {id:"ax-shouldercars",sets:"4 min · easy"},
    ]},
  ],
  "ap-gym4": [
    { name: "Session A — front-lever intensity", exercises: [
      {id:"ax-fl",      sets:"5×6–10 s best clean lever · 2–3 min"},
      {id:"ax-flrow",   sets:"3×3–5 FL row · 2–3 min"},
      {id:"ax-pullup",  sets:"3×3–5 weighted/strict · 2–3 min"},
      {id:"ax-invrow",  sets:"2×8–10 · 75 s"},
      {id:"ax-hollow",  sets:"2×20 s · 60 s"},
    ]},
    { name: "Session B — planche intensity and press", exercises: [
      {id:"ax-tuckplanche",sets:"5×6–10 s best clean planche · 2–3 min"},
      {id:"ax-ppp",        sets:"3×3–6 pseudo-planche press-up · 2 min"},
      {id:"ax-wallhspu",   sets:"3×3–5 partial/pike HSPU · 2–3 min"},
      {id:"ax-ringdip",    sets:"3×4–6 ring or parallel dip · 2 min"},
      {id:"ax-invrow",     sets:"2×10–12 scap row · 60 s"},
    ]},
    { name: "Session C — speed-skill maintenance", exercises: [
      {id:"ax-fl",         sets:"3×6–8 s easier lever · 2 min"},
      {id:"ax-planchelean",sets:"3×6–8 s easier lean · 2 min"},
      {id:"ax-lsit",       sets:"3×10–20 s compression · 90 s"},
      {id:"ax-muscleup",   sets:"3×3 transition drill · 2 min"},
      {id:"ax-pullup",     sets:"2×5–8 maintenance · 90 s"},
    ]},
  ],
  "ap-gym5": [
    { name: "Session A — primary straight-arm strength", exercises: [
      {id:"ax-fl",          sets:"5×6–10 s priority lever or planche · 3 min"},
      {id:"ax-flrow",       sets:"4×3–5 primary dynamic · 2–3 min"},
      {id:"ax-pullup",      sets:"3×3–5 weighted/advanced press · 2–3 min"},
      {id:"ax-invrow",      sets:"2×6–10 antagonist row/press · 90 s"},
      {id:"ax-shouldercars",sets:"3–5 min restoration · easy"},
    ]},
    { name: "Session B — non-priority maintenance and trunk", exercises: [
      {id:"ax-tuckplanche",sets:"3×6–8 s secondary progression · 2–3 min"},
      {id:"ax-pullup",     sets:"3×5–8 strict press/pull · 2 min"},
      {id:"ax-ringsupport",sets:"3×15–25 s ring support · 90 s"},
      {id:"ax-lsit",       sets:"3×10–20 s L/V-sit compression · 90 s"},
      {id:"ax-wristprep",  sets:"2×10–15 wrist/extensor · 60 s"},
    ]},
    { name: "Session C — high-skill expression", exercises: [
      {id:"ax-fl",          sets:"3×6–8 s easier primary static · 2–3 min"},
      {id:"ax-flrow",       sets:"3×2–4 transfer skill · 2–3 min"},
      {id:"ax-muscleup",    sets:"3×2–3 muscle-up or transition · 2–3 min"},
      {id:"ax-ringdip",     sets:"2–3×4–6 weighted dip/pull-up · 2 min"},
      {id:"ax-shouldercars",sets:"5 min mobility + documentation · easy"},
    ]},
  ],
};

type ProgrammeGuide = { intro: string; tips: string[] };

const PROGRAMME_GUIDES: Record<string, ProgrammeGuide> = {
  p0: {
    intro: "Eight weeks to build the movement patterns that matter. Three sessions per week — squat/hinge/push/pull, single-leg/press/carry, then a full reinforcement session. Start lighter than you think. The first two weeks are about learning the shapes, not loading them.",
    tips: [
      "Session A: goblet squat and RDL are your anchors — own the bottom position before adding load. Push-up and inverted row balance the session. Tempo 3-1-1-0 means 3 s down, 1 s pause, 1 s up, 0 s reset. Calf raise and dead bug finish it.",
      "Session B: split squat and farmer carry are the two hardest skills. Take the split squat slowly — front shin vertical, back knee drops down. Carry tall: ribs down, even steps, no lean.",
      "Session C: same patterns, lighter intent. Hip bridge and 90/90 hip switch earn their place — they build the tissue and mobility that keeps the rest progressing.",
      "Progression: double progression. When every set hits the top of the rep range at RPE ≤7 with clean technique, add the smallest available load (1–2 kg upper, 2–4 kg lower) and return to the low end of the range.",
    ],
  },
  p1: {
    intro: "Twelve weeks, four sessions per week. A coached progression through eccentric, isometric and explosive phases — three weeks each with a deload at weeks 4 and 8. Two lower sessions (A + C) and two upper sessions (B + D) per week, rotating A→B→C→D.",
    tips: [
      "Sessions A & C (lower): A is squat-led with goblet or barbell as the main lift; C is hinge-led with RDL. Different primary patterns, same quality standard. Main-lift tempo shifts each phase: eccentric (3 s down), isometric (pause at bottom), explosive intent.",
      "Sessions B & D (upper): B is horizontal press-led (bench + row); D is overhead + vertical pull (OHP + pulldown). Don't skip the pull sessions — they're what keeps shoulders healthy.",
      "Loading: choose a load matching the prescribed RPE for that week. RPE overrides the calendar — if you're genuinely fatigued, repeat the weight. Accessories use standard double progression.",
      "Phase arc: weeks 1–3 eccentric; weeks 5–7 isometric; weeks 9–11 explosive. Week 12 retests your week-1 benchmarks on the same exercises at the same ROM.",
    ],
  },
  p2: {
    intro: "Six weeks to earn back your range. Three sessions per week — hip and ankle control, thoracic and shoulder control, then integrated movement. You won't need much kit. You will need patience.",
    tips: [
      "Session A: hip CARs and 90/90 switches own the hip range. Ankle rock keeps the heel down and the knee tracking forward. Finish with a goblet squat to apply the new range under a small load.",
      "Session B: thoracic rotation and shoulder CARs first. Wall slide tests whether you can raise arms without flaring ribs. Suitcase carry transfers the shoulder control into walking — the position has to survive load.",
      "Session C: whole-body CAR sequence, then Cossack squat for lateral hip range. Goblet squat with pause locks in the new depth. Offset carry finishes with loaded anti-side-bend.",
      "Progress by control first: cleaner range → longer hold → fewer supports → only then a small external load. If a drill causes joint irritation the next morning, reduce range and reassess.",
    ],
  },
  p3: {
    intro: "Six weeks to build a bigger engine. Three sessions per week — one aerobic development session, one intervals session, and one strength-endurance circuit. Sustainable output beats a heroic single effort every time.",
    tips: [
      "Session A (aerobic): this is the easy day. Conversational pace, full sentences, smooth cadence. Duration builds from 20 to 35 minutes across the block. Do not make this hard — it should feel almost too easy.",
      "Session B (intervals): work at RPE 7–8, but the final interval should look like the first. Easy movement recovery between intervals. If you can't hold form, the interval is done.",
      "Session C (circuit): five stations, 3–4 rounds, 60–90 s rest between rounds. Step-up, farmer carry, inverted row, aerobic station, push-up. Pacing across rounds is the skill — start at 80% and build.",
      "Priority: sustainable duration and repeatable output. Keep A easy, B hard but controlled, C moderate. Never make all three days hard in the same week.",
    ],
  },
  p4: {
    intro: "Eight weeks of simple, repeatable training that fits around a busy life. Three sessions per week — squat/push, hinge/pull, and integrated. No complicated methods. Minimum effective progression. Show up, do the work, go again.",
    tips: [
      "Session A: goblet squat and push-up first, row and carry to finish. Keep the rep ranges honest — leave 2 reps in reserve every working set. The farmer carry earns your exit: carry tall, ribs down.",
      "Session B: RDL and overhead press as the hinge/push pairing, pulldown and split squat for single-leg and vertical pull. Shorter session than A — don't rush it.",
      "Session C: reverse lunge, hip thrust, incline press, inverted row, suitcase carry. The most complete session of the three — don't treat it as optional.",
      "If only 2 days available: rotate A and B in week 1, C and A in week 2, B and C in week 3. Keep the pattern; do not try to cram missed sessions into one day.",
    ],
  },
  p5: {
    intro: "Four weeks, two group sessions per week. A repeatable conditioning block with strength stations, controlled effort and simple logistics. Session A is aerobic strength, Session B is whole-body movement.",
    tips: [
      "Session A: six stations, 40 s each — row/bike, goblet squat, inverted row, farmer carry, push-up, anti-rotation band hold. Week 1 = 2 rounds, week 2 = 3 rounds, week 3 = 45 s work. Complete rounds, not maximum reps — pacing across rounds is the measure.",
      "Session B: six stations, same format — march, step-up, RDL, floor press, band row, suitcase carry. Use the regression options when needed — they're equal-status choices, not admissions of weakness.",
      "Progression: better control first, then work duration (40 s → 45 s), then load. The coach controls the clock and the standards; everyone works to their own level within the same time.",
      "Benchmark: sessions 2 and 8 use the same two-round test at fixed loads. Clean reps at four stations and average RPE — the score is quality, not fastest pace.",
    ],
  },
  "ap-found": {
    intro: "Eight weeks to build movement skill before chasing load. Three sessions per week — A is squat and bracing, B is hinge and pulling, C is integrated range. The goal is positions you can own, not numbers you can hit.",
    tips: [
      "Session A: goblet squat with a bottom pause teaches you to own the bottom before loading it. Split-squat isometric is harder than it looks — use a rail and build the hold before going hands-free. Ankle rock keeps the heel down; that's the whole exercise.",
      "Session B: the dowel hinge teaches the shape; the RDL loads it. Scapular push-up is a small movement — shoulder blades only, elbows stay long. Inverted row and side plank close the session.",
      "Session C: step-down is a single-leg deceleration drill — control the pelvis as you lower, not just the knee. 90/90 hip switch gets active hip range. Suitcase carry finishes with loaded anti-lean.",
      "Progression: add sets or hold time before load. A movement score of 2/2 is the goal. If you're at 0/2 on anything in week 4, repeat sessions rather than adding load.",
    ],
  },
  "ap-tendon": {
    intro: "Four weeks of graded lower-limb loading for pre-screened members — one session per tendon-intensive pattern, 48+ hours between exposures. This is a loading on-ramp, not a treatment protocol. If symptoms worsen, stop and seek clinical review.",
    tips: [
      "Session A: slow calf loading first. Isometric holds are easier on reactive tendons than dynamic reps — start there. Spanish squat reduces compressive knee load; box squat is the alternative if uncomfortable.",
      "Session B: RDL and hamstring bridge load the posterior chain. Slider curl starts bilateral and small-range — one leg and full range only when tolerated. Never push through tendon pain.",
      "Session C: integration at lower intensity. Split squat and hip thrust are the key movements; keep calf work at RPE 5–6. Dead bug and hip CARs close the session without extra tendon fatigue.",
      "Next-day rule: mild, short-lived muscle soreness is expected. Pain that worsens 24 hours after a session, or does not settle within 48 hours, means reduce load and reassess before the next session.",
    ],
  },
  "ap-platform": {
    intro: "Six weeks of general physical preparedness — quality strength on Session A, easy aerobic development on B, and a repeatable density circuit on C. More variety than a straight strength block, without the chaos of three max-effort circuits.",
    tips: [
      "Session A: moderate load, higher reps. Two to three reps in reserve on every set. Goblet squat and RDL set the tone — keep the hip hinge clean and don't chase numbers.",
      "Session B: the easy day is genuinely easy. Conversational pace, full sentences. Duration builds from 20 to 35 minutes across the block. Calf and tibialis raises are tissue maintenance, not a workout.",
      "Session C: density, not maximum effort. Log your rounds and loads; the benchmark is completing the same rounds with better quality, not more exhaustion. KB swing is swing only — hinge, not a back grind.",
      "Progression: Session B time builds before C load rises, and C quality improves before A load increases. Never make all three sessions hard in the same week.",
    ],
  },
  "ap-triphasic": {
    intro: "Three weeks, three sessions per week. One wave per week: eccentric emphasis week one, paused emphasis week two, fast-intent week three. Same movements, different cues. A technical exposure block for already-competent lifters — not a full strength cycle.",
    tips: [
      "Session A: front or back squat as the wave lift. Week 1 = 4-second eccentric. Week 2 = 2-second pause at your strong bottom. Week 3 = normal descent, fast intent on the way up. RDL stays at standard tempo every week.",
      "Session B: bench follows the same wave. Pull-up/pulldown at standard 2-1-1 all three weeks — pulling doesn't need the wave. Landmine press keeps shoulder health. Support holds add basic straight-arm positional work.",
      "Session C: trap-bar deadlift with fast intent on the rise — controlled descent, drive up with intent. KB swing only with sound technique; use a fast unloaded hinge drill if the swing isn't clean yet.",
      "Load: the wave cue changes, not necessarily the weight. Don't automatically add load because the week changed. RPE overrides the calendar every time.",
    ],
  },
  "ap-power": {
    intro: "Three weeks, three exposures per week. Session A is high neural load — first-step acceleration, jumps and basic power. Session B is deliberately low — easy movement, deceleration mechanics and technique. Session C integrates strength and power. Quality over quantity: two good accelerations beat eight tired ones.",
    tips: [
      "Session A: falling start teaches first-step push mechanics. Pogo is calf-stiffness training — quiet, springy ankle, not a ballistic drill. Broad jump with a stick landing: stick it, own it, reset, repeat.",
      "Session B: the recovery session is a real session. A-march develops leg action; planned deceleration to a stop is a skill you need before reactive cutting. Mirror shuffle — react and stabilise at modest speed.",
      "Session C: acceleration first while fresh. Trap-bar jump or jump squat needs prior assessment — if unsure, use a light loaded countermovement squat. Moderate loaded squat or deadlift at fast intent. Med-ball throw at max intent, low volume.",
      "Stop early: if speed clearly drops, posture deteriorates or any joint pain increases — session ends. Speed work is never finished on fumes.",
    ],
  },
  "ap-kb": {
    intro: "Six weeks of hardstyle kettlebell strength — tension, deliberate technique and repeatable quality. Three sessions: A is hinge and squat, B is press and Turkish get-up, C is clean, hinge and skill. Improve repeatability first, density second, bell size third.",
    tips: [
      "Session A: the swing is an expression of a good deadlift — if the hinge isn't there yet, stay on deadlift. Goblet squat owns the bottom; don't drop into it, control every centimetre.",
      "Session B: half-kneeling press locks the pelvis so the shoulder has to work. Turkish get-up stages — learn the floor-to-elbow and elbow-to-tall-sit before loading. Rack reverse lunge is asymmetrically loaded; control the front shin.",
      "Session C: the clean teaches the rack landing — no forearm slap, bell swings into the rack. Two-hand swing reinforces the hip snap from A. Goblet squat with a pause integrates the swing hip into the squat bottom.",
      "The 10×10 swing in week 4 is an optional benchmark, not a compulsory event. Attempt it only if weeks 2–3 were crisp and next-day recovery was normal.",
    ],
  },
  "ap-exstr": {
    intro: "Four weeks, four 25-minute sessions per week. Lower/upper/lower/upper split — not four full-body circuits. Rotate sessions in order; if life prevents four sessions, take the next in sequence rather than cramming.",
    tips: [
      "Session A: goblet or front squat and RDL — the two most efficient lower movements. Suitcase carry finishes the session in under two minutes. Start at RPE 6–7; there are three more sessions coming this week.",
      "Session B: push and pull. DB bench and chest-supported row. Side plank is 20–30 seconds — not a max hold, just a steady anti-rotation finish.",
      "Session C: split squat and hip thrust hit single-leg and posterior chain. Calf raise closes it. If time is very tight, drop the calf raise last — main lifts take priority.",
      "Session D: shoulder press and pulldown/pull-up fill the vertical gap. Farmer carry or Pallof press finishes with loaded carry or anti-rotation. Keep the time cap — 25 minutes out means 25 minutes out.",
    ],
  },
  "ap-excon": {
    intro: "Four weeks, three short conditioning sessions per week. Session A is genuinely easy aerobic work. Session B is controlled intervals — hard but measured. Session C is a quality 15-minute circuit. Never make all three days hard.",
    tips: [
      "Session A: conversational pace, full sentences, no race against the screen. Duration builds from 15 to 22 minutes. The easy session is where aerobic base is built — pushing it defeats the purpose.",
      "Session B: intervals at RPE 7–8, but the last interval should look like the first. If output drops across the set, the interval duration was too long. Recovery between intervals is programmed and mandatory.",
      "Session C: 15-minute circuit at a pace that preserves movement quality. Goblet squat, row, incline push-up, farmer carry, brisk march or bike. Pacing across the circuit is the skill — start controlled.",
      "Week 4: aerobic retest replaces Session B — same modality and conditions as your week 1 baseline. Note distance, feel and RPE. That comparison is the block result.",
    ],
  },
  "ap-mobility": {
    intro: "Eight weeks to actively own new range, then load it. Three sessions per week: A is hip and ankle, B is spine and shoulder, C integrates hamstrings and adductors. Select one or two priority joints at the start — trying to improve everything simultaneously improves nothing.",
    tips: [
      "Session A: hip CARs and 90/90 switches should feel like controlled joint movement, not a stretch. Ankle rock keeps the heel planted; if it rises, the range isn't available. Split-squat hold into goblet squat applies the new range.",
      "Session B: thoracic rotation without lumbar twist — if your ribs leave the floor in open-book, it's lumbar, not thoracic. Wall slide tests whether shoulders can go overhead without the ribs flaring. Landmine press and suitcase carry load the new range.",
      "Session C: active straight-leg raise uses your own hip flexors — no assistance, no momentum. Cossack squat with bench support teaches lateral hip range without forcing it. Step-down integrates everything into a single-leg task.",
      "Progress: range → active hold without support → small external load. If a drill worsens next-day joint pain, reduce range and reassess. Forced stretching is not in this programme.",
    ],
  },
  "ap-superjoints": {
    intro: "Twelve weeks of daily joint movement habit — five to ten minutes, most days. Two alternating sequences: A covers neck, shoulders, wrists and thoracic; B covers hips, knees, ankles and the squat pattern. The goal is regularity and smooth movement, not impressive range.",
    tips: [
      "Sequence A: neck moves are small and gentle — comfortable range, not end-range forcing. Shoulder CARs with stable ribs. Elbow circles are forearm rotation. Thoracic open-book rotates from the upper back.",
      "Sequence B: hip CARs without pelvic hiking. Knee circles are a gentle arc through comfortable range. Ankle circles then rocks. 90/90 switch or standing hip rotation to close. Assisted squat-to-stand at personal depth.",
      "Optional 2-minute focus: after either sequence, repeat the single stiffest movement for 1–2 sets of 3–5 deliberate reps. This is the whole practice, not an addition to it.",
      "Habit first: missing one day is not a failure. Aim for 5 days per week as the minimum. Reduce to 4 days in any high-fatigue week. Long-term consistency beats occasional perfect sessions.",
    ],
  },
  "ap-hs1": {
    intro: "Eight weeks to build a stable wall line and safe inversion habits. Three main sessions per week. You need to learn a safe exit before leaving a wall. Session A is inversion and line, B is push strength, C is entries and exits.",
    tips: [
      "Session A: chest-to-wall hold is the foundation. Push shoulders tall — scapulae elevate and rotate, not retract. Descend before the line fails, not after. Wall walk: controlled ascent and controlled exit, breath steady throughout.",
      "Session B: elevated pike push-up teaches the pressing line without full inversion. Incline push-up balances pressing without extra inversion load. Arch hold is controlled spinal extension — not lumbar compression.",
      "Session C: safe cartwheel or side-exit drill first, every session — this is non-negotiable. Kick-up to wall only if the exit skill is passed. Each kick-up is a reset; stop before entries deteriorate.",
      "Level gate: 3×20-s stable chest-to-wall or equivalent pike holds, independent safe exits, comfortable wrists and shoulders over two weeks. Do not advance on a calendar schedule.",
    ],
  },
  "ap-hs2": {
    intro: "Eight weeks to find the balance point and hold it. Three main sessions per week. Heel pulls and toe pulls are balance correction drills — subtlety is the point. Freestanding holds are a target, not a guaranteed eight-week outcome.",
    tips: [
      "Session A: chest-to-wall holds reinforce the line. Heel pulls from the wall — tiny fingertip pressure drives the correction, not a whole-body adjustment. Track your entries: how many out of ten land near vertical.",
      "Session B: lower inversion volume than A and C — the purpose is press strength. Elevated pike press-up, optional partial HSPU eccentric, inverted row to balance weekly pressing. Wrist conditioning closes it.",
      "Session C: freestanding attempts — log best controlled seconds, not total time. Stop after 3–4 poor entries or when fatigue starts. Best controlled seconds matter more than panic saves.",
      "Protect wrists: deload week 4 to roughly 60% of inversion volume. Persistent wrist discomfort means reduce volume, add wrist prep, and review hand placement before increasing again.",
    ],
  },
  "ap-hs3": {
    intro: "Six weeks for people who already have stable wall and freestanding balance. Three main sessions per week. Choose one primary skill — longer hold, press or HSPU — and maintain the others. A 30-second hold, press-to-handstand and strict HSPU are separate long-term goals.",
    tips: [
      "Session A: log clean catches and seconds on each attempt. Stop before shoulder collapse — a poor attempt does not build the skill. Shape drills (tuck or straddle weight shift) only if balance is reliable.",
      "Session B: press emphasis. Deficit pike press or partial HSPU — technically sound depth only, no neck loading. Pull-ups maintain opposing strength; don't skip them. Compression lifts develop active hip range for the press entry.",
      "Session C: straddle compression with negative into the wall press position — elevated feet or block support initially. Box-assisted press-to-handstand is a hip-and-shoulder lift, not a jump. Parallette support builds the pressing base.",
      "One variable at a time: add seconds, reduce assistance, or add a set — not all three in the same week. Six weeks rarely delivers a full press; plan a second cycle before expecting it.",
    ],
  },
  "ap-gym1": {
    intro: "Eight weeks to build the fundamentals of straight-arm gymnastics — hollow and arch shapes, scapular strength, pushing and pulling, and a basic support position. Prerequisites: comfortable wrists, a basic push-up and a controlled inverted row.",
    tips: [
      "Session A: hollow hold is the gymnastic spine — ribs down, lower back supported by trunk action, not glute squeeze alone. Arch hold is the opposite shape. Practice both before loading either. L-sit starts as a tuck — that's the exercise.",
      "Session B: active hang is scapular depression and elevation under bodyweight. Support hold is shoulder depression — arms long, shoulders away from ears. These two positions underpin everything in gymnastic training.",
      "Session C: tuck L-sit develops the compression skill needed for every higher L-sit and lever. Pike shoulder shift teaches the hollow-position weight shift critical for handstand and pressing work later.",
      "L2 gate: 3×20-s stable support, 3×20-s hollow, 3×8 quality rows and push-ups, pain-free wrist and shoulder loading. Eight weeks elapsed is not the gate — the skill standards are the gate.",
    ],
  },
  "ap-gym2": {
    intro: "Eight weeks to develop the tuck front lever, planche lean and better vertical pulling. Requires L1 competency. Ring dips, German hangs and skin-the-cat are not in this programme — they are advanced options for a later level.",
    tips: [
      "Session A: tuck front lever with band assistance if needed — posterior pelvic tilt and scapular control. Front lever rows demand the same geometry on every rep; if it breaks, the set ends. Straight-arm cable pulldown as light lat practice.",
      "Session B: planche lean is a small body-weight shift forward — shoulders protract, lean minimal. Pseudo-planche push-up keeps the lean consistent on every rep. Parallel-bar dip only after controlled support — not a default beginner exercise.",
      "Session C: balance the volume from A and B without adding a third hard session. L-sit compression and inverted row for balance. Alternate the technique exposure between easier lever and planche lean.",
      "L3 gate: 3×10-s true controlled tuck front lever, 3×10-s pain-free planche lean with stable scapula, 5 strict pull-ups. The connective tissue build at L2 is slow — respect it.",
    ],
  },
  "ap-gym3": {
    intro: "Eight weeks of advanced-tuck lever, assisted tuck planche and appropriately controlled ring work. Requires L2 gate. Do not introduce ring dips and long-lever isometrics at full dose simultaneously — the connective tissue load compounds.",
    tips: [
      "Session A: advanced-tuck front lever means hips at shoulder height, body more horizontal. Band as needed — shape integrity first. Lever rows: same angle on every rep, not a swing. Weighted pull-ups build the pulling base.",
      "Session B: tuck planche on parallettes — slightly easier on the wrists than floor. Pseudo-planche push-up at the same lean every rep. Ring support with feet-assisted if needed — quiet rings means stable shoulders.",
      "Session C: lower-intensity exposure. Easier lever and planche geometries for technique, not max load. Ring push-up into ring dip only after stable unassisted support, and only with a coach.",
      "Deload week 4: reduce demanding straight-arm work by 40%. Film technique on the deload week — this is often when you see most clearly what the body has learned.",
    ],
  },
  "ap-gym4": {
    intro: "Six weeks working toward straddle lever and planche geometry through individually chosen progressions. Choose the highest-leverage clean hold for each skill and use it. Muscle-up is an optional branch, not a compulsory requirement.",
    tips: [
      "Session A: five sets of your best clean 6–10-s lever hold. Use band, one-leg or banded straddle assistance — forced straddle without the strength is not the exercise. Lever rows at the same pelvis angle across every rep.",
      "Session B: five sets of your best clean planche or lean. Wall HSPU partial or pike HSPU for the vertical press — range is earned, not forced. Ring dip only with robust stable support.",
      "Session C: same skills at reduced intensity — maintenance and technique. Muscle-up transition drill only with skill coaching; unqualified attempts are not in this programme.",
      "L5 gate: coach-reviewed video, sustained 3×8–10-s high-leverage holds, strict pulling and pushing base, no persistent joint complaints. Most people should stay at L4 until these are genuinely solid.",
    ],
  },
  "ap-gym5": {
    intro: "Six weeks of high-level, individually scaled straight-arm training. Choose one primary priority — lever or planche — and maintain the other. Requires an experienced coach sign-off. Elite describes the readiness band, not a promise of full skills in six weeks.",
    tips: [
      "Session A: five sets of your best clean hold for the priority skill. Primary dynamic progression — lever rows for lever, planche lean push-ups for planche. Weighted pull-up or advanced press matched to the priority.",
      "Session B: secondary skill at a lower geometry — one step easier than your ceiling. Ring support with rings-turned-out only if already qualified. L-sit or V-sit compression for the trunk.",
      "Session C: primary static at lower intensity than A. Transfer skill — choose one (lever pull, planche lean, assisted press), not all three. Muscle-up only if already owned. Document form and next-day tendon response every session.",
      "Recovery is the ceiling: if next-day tendon response is elevated, reduce static volume before reducing intensity. Technical sophistication never justifies connective tissue overload at this level.",
    ],
  },
};

function injectExerciseVideos(w: any): void {
  for (const e of w.exercises) {
    if (!e.videoUrl && VIDEO_URLS[e.id]) {
      e.videoUrl = VIDEO_URLS[e.id];
    }
  }
}

// Every exercise id a member may legitimately log for a programme: its flat
// exercise list PLUS any rotating-session exercises shown in the member view
// (injected from PROGRAMME_SESSIONS or coach-defined p.sessions). The write
// path validates against this union so session logs are not rejected.
export function programmeExerciseIds(p: any): Set<string> {
  const ids = new Set<string>((p?.exercises || []).map((e: any) => e.id));
  const sessions = Array.isArray(p?.sessions) ? p.sessions : PROGRAMME_SESSIONS[p?.id] || [];
  for (const s of sessions) for (const e of s.exercises || []) ids.add(e.id);
  return ids;
}

function injectProgrammeSessions(w: any): void {
  for (const p of w.programmes) {
    if (!Array.isArray(p.sessions) && PROGRAMME_SESSIONS[p.id]) {
      p.sessions = PROGRAMME_SESSIONS[p.id];
    }
    if (!p.guide && PROGRAMME_GUIDES[p.id]) {
      p.guide = PROGRAMME_GUIDES[p.id];
    }
  }
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function weekdayMon0(d: Date): number {
  return (d.getUTCDay() + 6) % 7; // Monday=0 … Sunday=6, matching Python date.weekday()
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function mondayOf(d: Date): Date {
  return addDays(d, -weekdayMon0(d));
}
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Python round() is round-half-to-even; values here are non-negative.
function bankersRound(x: number): number {
  if (Math.abs(x - Math.trunc(x) - 0.5) < 1e-9) {
    const floor = Math.floor(x);
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

export function analytics(w: any): any {
  normalizeClients(w);
  const now = parseDate(today());
  const monday = mondayOf(now);
  for (const c of w.clients) {
    const days: Date[] = w.logs
      .filter((l: any) => l.client === c.id)
      .map((l: any) => parseDate(l.date));
    const p = w.programmes.find((p: any) => p.id === (c.programmes as string[])[0]) || null;
    const completed = days.filter((d) => d >= monday && d <= now).length;
    c.adherence = Math.min(100, bankersRound((completed / (p ? p.frequency : 3)) * 100));
    const weeks = new Set(days.filter((d) => d <= now).map((d) => dateKey(mondayOf(d))));
    let cursor = weeks.has(dateKey(monday)) ? monday : addDays(monday, -7);
    let streak = 0;
    while (weeks.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -7);
    }
    c.streak = streak;
  }
  return w;
}

export function viewFor(user: any, wIn: any): any {
  const w = analytics(structuredClone(wIn));
  injectExerciseVideos(w);
  if (user.role === "coach") return w;
  injectProgrammeSessions(w);
  const cid = user.client;
  const own = w.clients.find((c: any) => c.id === cid);
  if (!own) throw new APIError("This client account is no longer available.", 403);
  // Club feed: own posts + posts from members who opted into club sharing,
  // annotated with display names (first name + last initial) before clients
  // are stripped from the view.
  const display = (name: string) => {
    const parts = String(name).trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  };
  const optIn = new Map(w.clients.map((c: any) => [c.id, !!c.leaderboardOptIn]));
  const names = new Map(w.clients.map((c: any) => [c.id, display(c.name)]));
  w.feed = (Array.isArray(w.feed) ? w.feed : [])
    .filter((f: any) => f.client === cid || optIn.get(f.client))
    .slice(0, 50)
    .map((f: any) => ({ ...f, name: names.get(f.client) || "A member" }));
  own.notes = [];
  delete own.victorNotes;
  w.clients = [own];
  // All programmes are visible to members as a read-only catalogue;
  // own.programmes identifies which ones are assigned to them.
  for (const k of ["logs", "meals", "measures"]) {
    w[k] = w[k].filter((r: any) => r.client === cid);
  }
  w.sessions = w.sessions
    .filter((s: any) => s.clients.includes(cid))
    .map((s: any) => ({
      ...s,
      clients: [cid],
      attended: (s.attended || []).includes(cid) ? [cid] : [],
    }));
  w.water = Object.fromEntries(
    Object.entries(w.water).filter(([k]) => k.startsWith(cid + "-")),
  );
  w.activity = [];
  w.settings = {
    club: w.settings.club,
    coach: w.settings.coach,
    ...(w.settings.whatsapp ? { whatsapp: w.settings.whatsapp } : {}),
  };
  w.readNotifications = [];
  return w;
}
