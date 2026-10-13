// Ascent exercise library + 10 group-based programmes (v2) for the supple club.
// Built on the Dean Bradley pyramid: concurrent group sessions where varied work
// is the active rest; ratios flex by phase. The `sets` field on each programme
// exercise carries the GROUP + ROLE + prescription + week-to-week progression;
// the programme `description` carries the phase goal + weekly arc.
// videoUrl is filled by load-content.mjs from the video maps (matched by name).
// IDs are prefixed ax-/ap- so they never clash with anything already in the club.

function mk(id, name, category, equipment, cues) {
  return { id: "ax-" + id, name, category, equipment, prescription: "see programme", cues, video: false, videoUrl: "" };
}

export const exercises = [
  // ---- Mobility / CARs / control ----
  mk("hipcars", "Hip CARs", "Mobility", "Bodyweight", ["Biggest circle the hip can make, slow and controlled.", "Keep ribs down and the rest of the body still.", "Explore the outer edges of the range you own."]),
  mk("shouldercars", "Shoulder CARs", "Mobility", "Bodyweight", ["Slow controlled circle of the shoulder, arm straight.", "Keep the ribs down — no arching to cheat range.", "Find and own the end ranges."]),
  mk("catcow", "Cat-Cow to Thoracic Rotation", "Mobility", "Bodyweight", ["Flow the spine segment by segment, breathe with it.", "Then reach one arm through and open to rotate the mid-back.", "Slow and smooth — feel each vertebra."]),
  mk("wallslide", "Wall Slide", "Upper body", "Wall", ["Back flat to the wall, ribs down, arms in a goalpost.", "Slide up keeping wrists and elbows on the wall.", "Only go as high as you can without the ribs flaring."]),
  mk("scappush", "Scapular Push-Up", "Upper body", "Bodyweight", ["Straight arms in a plank, trunk rigid.", "Pinch the shoulder blades, then push the floor to spread them.", "Small, controlled range — it's the blades moving, not the elbows."]),
  mk("anklerock", "Knee-to-Wall Ankle Rock", "Mobility", "Wall", ["Toe a few inches from the wall, drive the knee over the toes to touch.", "Keep the heel down the whole time.", "Work the range you can control, both sides."]),
  mk("deepsquat", "Deep Squat Hold", "Mobility", "Bodyweight", ["Sit into the deepest squat you can own, heels down.", "Elbows inside the knees, chest tall, pry gently.", "Breathe and settle — relax into the position."]),
  mk("ninety", "90/90 Hip Switch", "Mobility", "Bodyweight", ["Both knees at 90°, sit tall, drive the back glute to turn.", "Move slowly through the range you own — no forcing.", "Chest up; actively pull into each side."]),
  mk("jeff", "Jefferson Curl", "Mobility", "Light weight", ["Stand on a box, roll down one vertebra at a time, legs straight.", "Let the weight pull you into a loaded end-range, slow.", "Roll up segment by segment. Start very light."]),
  // ---- Lower body / tissue ----
  mk("sq", "Back Squat", "Lower body", "Barbell", ["Brace 360° before you unrack.", "Sit between the hips, knees track over toes, drive the floor apart.", "Own the bottom on tempo work, then stand tall."]),
  mk("frontsquat", "Front Squat", "Lower body", "Barbell", ["Elbows high, bar on the shelf of the shoulders.", "Sit straight down, torso tall, knees forward over toes.", "Drive up without the elbows dropping."]),
  mk("gsq", "Goblet Squat", "Lower body", "Kettlebell", ["Bell tight to the chest, elbows inside the knees at the bottom.", "Sit between the hips, heels planted, chest proud.", "Smooth down, strong up — control the eccentric."]),
  mk("splitsquat", "Split Squat (Hold)", "Lower body", "Bodyweight/DB", ["Long stance, torso tall, back knee drops straight down.", "Front shin travels, weight in the front heel.", "Own the bottom position — pause and hold it strong."]),
  mk("bss", "Bulgarian Split Squat", "Lower body", "Dumbbells", ["Back foot on the bench, weight in the front leg.", "Drop straight down, slight forward lean, own the stretch.", "Drive up through the front heel."]),
  mk("revlunge", "Reverse Lunge", "Lower body", "Dumbbells", ["Step back, drop the back knee under control.", "Keep the front shin fairly vertical, torso tall.", "Drive through the front heel to stand."]),
  mk("latlunge", "Lateral Lunge", "Lower body", "Bodyweight/DB", ["Step wide, sit back into the bent leg, other leg straight.", "Keep the stepping foot flat, chest up.", "Push back to the middle — own the groin stretch."]),
  mk("cossack", "Cossack Squat", "Mobility", "Bodyweight", ["Wide stance, sit into one hip, other leg straight, toe up.", "Stay as upright as you can, heel down.", "Control the depth you own — don't collapse."]),
  mk("stepup", "Step-Up", "Lower body", "Box/DB", ["Full foot on the box, drive through the heel.", "Stand tall at the top, minimal push off the back foot.", "Lower under control — don't drop."]),
  mk("stepdown", "Step-Down", "Lower body", "Box", ["Stand on the box, lower the other heel slowly to tap the floor.", "Keep the knee tracking over the toes, no cave.", "It's the standing leg doing the work — control it."]),
  mk("wallsit", "Wall Sit", "Lower body", "Wall", ["Back flat on the wall, thighs parallel, shins vertical.", "Drive the feet down, hold the position hard.", "Breathe steady — own the isometric."]),
  mk("span", "Spanish Squat (isometric)", "Lower body", "Resistance band", ["Band around the knees anchored in front, sit back into it.", "Shins vertical, load the quads and the patellar tendon.", "Settle in and hold the dwell, breathe steady."]),
  mk("ht", "Barbell Hip Thrust", "Lower body", "Barbell", ["Shoulder blades on the bench, chin tucked, ribs down.", "Drive through the heels, squeeze the glutes hard at the top.", "Full lockout to a tabletop, lower with control."]),
  // ---- Hinge / hamstring ----
  mk("rdl", "Romanian Deadlift", "Lower body", "Barbell/KB", ["Soft knees, push the hips back — feel the hamstrings lengthen.", "Bar stays close, shins vertical, long spine.", "Own the long muscle length, then squeeze the glutes up."]),
  mk("tbdl", "Trap-Bar Deadlift", "Lower body", "Trap bar", ["Hips between a squat and a hinge, chest up, slack out.", "Push the floor away through mid-foot.", "Lock out tall; lower under control."]),
  mk("hambridge", "Hamstring Bridge", "Lower body", "Bodyweight", ["Heels down, drive the hips up, squeeze the glutes.", "Long-lever (heels further out) to bias the hamstrings.", "Control the lower; keep ribs down."]),
  mk("slidercurl", "Slider Hamstring Curl", "Lower body", "Sliders", ["Bridge up, slide the heels out slowly, hips stay high.", "Fight the eccentric — the hamstrings resist the slide.", "Pull back in; regress to double-leg if cramping."]),
  mk("nordic", "Nordic Hamstring Curl", "Lower body", "Bodyweight", ["Anchor the ankles, hips and shoulders in one line.", "Lower as slowly as you can control.", "Catch with the hands, push back up."]),
  // ---- Calf / foot ----
  mk("calfraise", "Full-Range Calf Raise", "Lower body", "Step", ["Full stretch at the bottom, full squeeze at the top.", "Slow and controlled — no bouncing.", "Straight knee for gastroc, bent knee for soleus."]),
  mk("tibraise", "Tibialis Raise", "Lower body", "Wall/Bodyweight", ["Heels planted, pull the toes up towards the shins.", "Control the lower, full range.", "Builds the front of the shin — balances the calf."]),
  // ---- Adductor ----
  mk("copenhagen", "Copenhagen Plank", "Core", "Bench", ["Top leg on the bench, body in a straight side-plank line.", "Squeeze the top adductor to hold level.", "Regress with the bottom knee down; build the hold time."]),
  // ---- Push ----
  mk("ohp", "Standing Overhead Press", "Upper body", "Barbell", ["Stack the bar over mid-foot, squeeze glutes, ribs down.", "Press straight up, head back then through.", "Lock out with biceps by the ears."]),
  mk("floorpress", "Barbell Floor Press", "Upper body", "Barbell", ["Triceps touch the floor at the bottom — no bounce.", "Tuck the elbows ~45°, drive up and slightly back.", "Pressing strength without a bench."]),
  mk("pushup", "Push-Up", "Upper body", "Bodyweight", ["Hands under the shoulders, body one rigid line.", "Lower under control, elbows ~45°, chest to floor.", "Press the floor away, spread the blades at the top."]),
  mk("kbpress", "Single-Arm Kettlebell Press", "Upper body", "Kettlebell", ["Rack tight: fist at the chest, elbow down, wrist straight.", "Brace the trunk, press straight up, no lean.", "Lock out overhead, lower to the rack under control."]),
  // ---- Pull ----
  mk("pullup", "Pull-Up", "Upper body", "Pull-up bar", ["Dead hang, shoulders active (down and back).", "Lead with the chest, pull the elbows to the ribs.", "Chin over the bar, lower all the way."]),
  mk("row", "Bent-Over Barbell Row", "Upper body", "Barbell", ["Hinge to ~45°, long spine, bar under the shoulders.", "Row to the lower ribs, squeeze the mid-back.", "Control the lower — no heave."]),
  mk("invrow", "Inverted / Ring Row", "Upper body", "Rings or bar", ["Body rigid and straight, pull the chest to the bar/rings.", "Elbows to the ribs, full scapular reach at the bottom.", "Raise the feet to progress."]),
  // ---- Kettlebell ballistic ----
  mk("swing", "Hardstyle Kettlebell Swing", "Full body", "Kettlebell", ["Hike the bell back high — it's a hinge, not a squat.", "Snap the hips through, glutes hard, bell floats to chest height.", "Sharp exhale + brace at the top; catch with the hips."]),
  mk("kbcp", "Kettlebell Clean & Press", "Full body", "Kettlebell", ["Clean: zip the bell up, land soft in the rack — no bang.", "Rack tight, then press with a braced trunk.", "Lock out overhead, lower to the rack."]),
  mk("tgu", "Turkish Get-Up", "Full body", "Kettlebell", ["Eyes on the bell, wrist stacked over the elbow.", "Roll to elbow → hand → bridge → sweep → lunge → stand.", "Slow and deliberate; reverse the steps down."]),
  // ---- Plyometric / speed / power ----
  mk("pogo", "Pogo Jumps", "Conditioning", "Bodyweight", ["Stiff ankles, bounce off the balls of the feet.", "Minimal ground time — think 'hot floor'.", "Tall and springy; an ankle/Achilles drill."]),
  mk("broad", "Broad Jump", "Conditioning", "Bodyweight", ["Dip, swing the arms, drive the hips forward and out.", "Full triple extension; land soft and balanced.", "Reset each rep for quality."]),
  mk("box", "Box Jump", "Conditioning", "Plyo box", ["Explode up, drive the knees, land soft and quiet.", "Land in a quarter-squat — absorb, don't collapse.", "Step down to save the tendons."]),
  mk("jumpsquat", "Jump Squat", "Conditioning", "Bodyweight", ["Quarter-dip, explode up through full extension.", "Land soft in the same position, absorb.", "Max intent each rep; stop when height drops."]),
  mk("latbound", "Lateral Bound", "Conditioning", "Bodyweight", ["Push off the outside leg, bound sideways, stick the landing.", "Land on one leg, hold the position a beat.", "Control before power — own the stick."]),
  mk("askip", "A-Skip", "Conditioning", "Bodyweight", ["Tall posture, drive the knee up, foot down under the hip.", "Quick contacts, dorsiflexed foot, rhythmic arms.", "Rhythm and stiffness, not height."]),
  mk("accel", "Short Acceleration Sprint", "Conditioning", "Bodyweight", ["Fall into it or push start; shin angles forward, drive back.", "Powerful arms, gradual rise — don't pop up early.", "Full recovery between reps — this is speed, not conditioning."]),
  mk("mbslam", "Med Ball Slam", "Full body", "Med ball", ["Reach tall, then slam the ball down with the whole body.", "Hinge and follow through, exhale hard.", "Max intent; catch or grab and reset."]),
  // ---- Gymnastic strength ----
  mk("hs", "Wall Handstand Hold", "Full body", "Wall", ["Chest-to-wall, hands a hand's-length off the skirting.", "Posterior tilt, ribs down, push the floor away.", "Build the hold time before freestanding."]),
  mk("lsit", "L-Sit", "Core", "Parallettes/floor", ["Depress the shoulders, push down hard, lock the knees.", "Hollow the trunk, point the toes, lift to the L.", "Regress to tuck or one leg."]),
  mk("fl", "Tuck Front Lever", "Full body", "Pull-up bar", ["Straight arms, pull the bar towards the hips — lats drive it.", "Tuck tight, flat back parallel to the floor, ribs down.", "Open the tuck gradually as you get stronger."]),
  mk("hollow", "Hollow Body Hold", "Core", "Bodyweight", ["Lower back pressed flat — no gap.", "Arms and legs extended, shoulders and heels just off the floor.", "Regress by tucking the knees or raising the arms."]),
  // ---- Core / anti-movement / carry ----
  mk("deadbug", "Dead Bug", "Core", "Bodyweight", ["Ribs down, lower back glued to the floor, slow breathing.", "Extend opposite arm and leg, trunk perfectly still.", "Exhale as you reach; quality over speed."]),
  mk("pallof", "Pallof Press", "Core", "Band/cable", ["Band at chest height from the side, stand tall and braced.", "Press straight out and resist the rotation.", "Hold at full extension, return with control."]),
  mk("sideplank", "Side Plank", "Core", "Bodyweight", ["Elbow under the shoulder, body one straight line.", "Hips high, squeeze the down-side obliques.", "Regress to the bottom knee down."]),
  mk("suitcase", "Suitcase Carry", "Full body", "Kettlebell/DB", ["One weight, stand dead tall — no side lean.", "Brace hard, walk under control.", "Switch sides; the anti-lean is the work."]),
  mk("farmer", "Farmer Carry", "Full body", "KB/DB", ["Weight both sides, tall posture, shoulders packed.", "Brace and walk with control, smooth steps.", "Grip and trunk under load — don't rush."]),
  mk("bearcrawl", "Bear Crawl", "Full body", "Bodyweight", ["Knees hover under the hips, flat back, brace.", "Move opposite hand and foot, hips stay level.", "Small steps, controlled — no rocking."]),
];

// Programme exercise reference: id + the group/role/prescription/progression line.
function ex(id, sets) {
  return { id: "ax-" + id, sets };
}
function pg(id, name, goal, weeks, frequency, colour, description, exercises) {
  return { id: "ap-" + id, name, goal, weeks, frequency, colour, description, exercises };
}

export const programmes = [
  // 1. FOUNDATIONS & CONTROL — lots of control/mobility/holds, low fatigue
  pg("found", "Foundations & Control", "Movement", 8, 3, "light",
    "~45 min · Own the basics. Run each group as a circuit ×2 rounds, rest 60s between rounds. Tempo a-b-c = secs down-pause-up (TUT). Wk1-3 groove patterns, wk4-6 add range, wk7 light load, wk8 easy. Quality over sweat.", [
    ex("gsq", "G1 main · 2×8 @ 3-0-1 · brace first"), ex("deadbug", "G1 active rest · 2×8/side · slow exhale"), ex("splitsquat", "G1 hold · 2×20s/side · own the position"), ex("anklerock", "G1 mobility · 2×10/side · easy"),
    ex("rdl", "G2 hinge · 2×8 light @ 3-0-1"), ex("scappush", "G2 shoulder · 2×10 · slow + full"), ex("hambridge", "G2 tissue · 2×10 @ 2-1-1"), ex("hipcars", "G2 mobility · 2×3/dir · slow circles"),
    ex("pushup", "G3 push · 2×8-12 @ 2-0-1"), ex("invrow", "G3 pull · 2×8-12 @ 2-0-1"), ex("suitcase", "G3 carry · 2×25m/side · tall, no lean"), ex("deepsquat", "G3 hold · 2×30s · breathe + pry"),
    ex("stepdown", "G4 knee · 2×6/side · 3s down"), ex("tibraise", "G4 ankle · 2×15 · full range"), ex("calfraise", "G4 calf · 2×12 @ 2-1-2"), ex("hollow", "G4 core · 2×20s · ribs down"),
  ]),
  // 2. TENDON REBUILD — isometric → slow → eccentric, minimal ballistic
  pg("tendon", "Tendon Rebuild", "Tissue capacity", 4, 3, "sage",
    "~45 min · Tissue-first: iso → slow strength → eccentric. Circuits ×2 per group, rest 60-90s between rounds. Tempo 3-1-1 ≈ 5s TUT per rep. Wk1 holds, wk2-3 add load + ROM, wk4 low pogo if pain-free. Load off the next-morning tendon response.", [
    ex("span", "G1 knee iso · 2×30-45s · firm, breathe"), ex("calfraise", "G1 calf · 2×12 @ 3-1-1 slow"), ex("stepdown", "G1 patellar · 2×6-8/side · 3s down"), ex("tibraise", "G1 ankle · 2×15-20 · pump"),
    ex("rdl", "G2 hinge · 2×6-8 @ 3-1-1 · hams loaded"), ex("hambridge", "G2 ham iso · 2×20-30s long-lever"), ex("slidercurl", "G2 eccentric · 2×6-10 · 5s slide out"), ex("ninety", "G2 mobility · 2×8/side · slow"),
    ex("copenhagen", "G3 adductor · 2×15-25s/side"), ex("revlunge", "G3 single-leg · 2×6-8/side @ 2-0-1"), ex("latlunge", "G3 frontal · 2×6/side · sit in"), ex("bss", "G3 knee · 2×6/side @ 3-0-1"),
    ex("farmer", "G4 carry · 2×30-40m · heavy, tall"), ex("pallof", "G4 anti-rot · 2×8-10/side · 2s hold"), ex("bearcrawl", "G4 crawl · 2×10-20m · slow, flat back"), ex("deadbug", "G4 core · 2×8/side · exhale"),
  ]),
  // 3. PLATFORM — GPP/strength-endurance: dense, concurrent, active-rest heavy
  pg("platform", "Platform · Strength-Endurance", "GPP", 6, 3, "slate",
    "~50 min · Engine + full-ROM strength. Groups = circuits ×2, short rest 30-60s — the varied moves ARE the rest. RPE 6-8, shape holds. Wk1-2 density, wk3-4 add load, wk5 push rounds, wk6 deload −40%. Finish: 8-12 min steady swings/squat/carry/crawl.", [
    ex("swing", "G1 main · 2×15 · crisp hip snap"), ex("deadbug", "G1 active rest · 2×8/side"), ex("gsq", "G1 lower · 2×12 full ROM @ 2-0-1"), ex("shouldercars", "G1 mobility · 2×3/dir"),
    ex("pushup", "G2 main · 2×10-15 @ 2-0-1"), ex("splitsquat", "G2 hold · 2×20s/side"), ex("rdl", "G2 hinge · KB 2×12 @ 2-0-1"), ex("hipcars", "G2 mobility · 2×3/dir"),
    ex("invrow", "G3 main · 2×10-12 · full reach"), ex("suitcase", "G3 carry · 2×25m/side · tall"), ex("stepup", "G3 lower · 2×10/side · drive the heel"), ex("tibraise", "G3 ankle · 2×20"),
  ]),
  // 4. TRIPHASIC STRENGTH — heavy mains, full recovery, active rest = CARs
  pg("triphasic", "Triphasic Strength", "Max strength", 3, 3, "dark",
    "~60 min · Heavy and clean, FULL recovery between main sets (2-3 min — do the CARs while you rest). Weekly tempo wave: Wk1 eccentric 5s down · Wk2 isometric 3s pause in the hole · Wk3 explosive up. Stop a rep shy of grinding; tendons get a vote.", [
    ex("frontsquat", "G1 main · 4×5 · wk1 5s ecc / wk2 3s pause / wk3 fast · rest 2-3min"), ex("shouldercars", "G1 active rest · 3/dir between sets"),
    ex("tbdl", "G2 hinge · 4×4-6 · same weekly tempo · rest 2-3min"), ex("calfraise", "G2 active rest · 12 slow"),
    ex("swing", "G3 power · 8×10 crisp · rest 60s"), ex("deadbug", "G3 active rest · 6/side"),
    ex("floorpress", "G4 press · 4×6 @ 3-1-1 · rest 90s"), ex("pullup", "G4 pull · 4×5 full hang · rest 90s"), ex("hipcars", "G4 active rest · 3/dir"),
    ex("splitsquat", "G5 circuit ×2-3 · 20s/side hold"), ex("copenhagen", "G5 circuit ×2-3 · 20s/side"), ex("tibraise", "G5 circuit ×2-3 · 15-20"), ex("suitcase", "G5 circuit ×2-3 · 25m/side"),
  ]),
  // 5. POWER & SPEED — fresh CNS, primer + contrast, quality not density
  pg("power", "Power & Speed", "Power/speed", 3, 3, "stone",
    "~55 min · Speed is skill: train FRESH, quality over density, 95%+ recovery on fast work (2-3 min between efforts). Contrast = heavy set, then the explosive pair straight after. Wk1 10-20m accels, wk2 add contrast load, wk3 30m + flying starts. Stop when speed drops.", [
    ex("askip", "P1 primer · 4×20m · tall + springy"), ex("accel", "P1 speed · 6×10-20m · FULL rest 2-3min"), ex("pogo", "P1 elastic · 4×10 · min ground time"),
    ex("sq", "G2 contrast A · 4×3 heavy, fast intent · rest 2min"), ex("broad", "G2 contrast B · 4×3 max · straight after squat"), ex("hipcars", "G2 active rest · 3/dir"),
    ex("swing", "G3 power · 5×10 crisp · rest 60-90s"), ex("box", "G3 plyo · 4×3 · step down + reset"), ex("mbslam", "G3 throw · 4×5 max intent"),
    ex("latbound", "G4 reactive · 4×4/side · stick 1s"), ex("nordic", "G4 hams · 3×5 · slow as possible"), ex("pallof", "G4 anti-rot · 8/side @ 2s hold"),
  ]),
  // 6. KETTLEBELL STRONG (Pavel) — strength as skill, submaximal, tension
  pg("kb", "Kettlebell Strong", "Strength skill", 6, 3, "",
    "~45 min · Strength is a skill: crisp tension, power breathing, always 2+ reps in reserve — never to failure. Rest 30-90s between sets; do the CARs while you rest. Wk1-2 own technique, wk3-4 heavier bell, wk5 density, wk6 easy.", [
    ex("swing", "G1 main · 10×10 hardstyle snap · rest 30-60s"), ex("deadbug", "G1 active rest · 8/side"),
    ex("gsq", "G2 main · 5×5 full ROM @ 2-1-1 · rest 60s"), ex("hipcars", "G2 active rest · 3/dir"),
    ex("kbpress", "G3 main · 5×3/side strict · no grind · rest 60-90s"), ex("shouldercars", "G3 active rest · 3/dir"),
    ex("tgu", "G4 skill · 3×1/side · slow + perfect"), ex("suitcase", "G4 carry · 25m/side · tall"), ex("kbcp", "G4 complex · 5/side smooth"),
  ]),
  // (Gymnastic Strength is now the dedicated 5-level suite in ascent-gymnastics.mjs)
  // 8. EXPRESS STRENGTH — 2 groups, big movements, ~25 min
  pg("exstr", "Express Strength", "Strength", 4, 4, "dark",
    "~25 min · Two groups, big moves, done. G1 = straight sets, rest 60s (dead bugs while you rest). G2 = circuit ×3, rest 30-45s between rounds. Tempo ~2-0-1, keep 2 reps in reserve. Wk1-2 groove, wk3 add load, wk4 easy.", [
    ex("gsq", "G1 main · 4×6 full ROM @ 2-0-1 · rest 60s"), ex("deadbug", "G1 active rest · 8/side"),
    ex("rdl", "G2 circuit · 3×8 @ 2-1-1"), ex("pushup", "G2 circuit · 3×12 @ 2-0-1"), ex("invrow", "G2 circuit · 3×10 · full reach"),
  ]),
  // 9. EXPRESS CONDITIONING — 15-min AMRAP for quality, ~25 min
  pg("excon", "Express Conditioning", "Conditioning", 4, 3, "stone",
    "~25 min · 15-min AMRAP for QUALITY: steady rounds in order, break a set BEFORE shape fails, walk 30s if breathing runs away. RPE 6-8; score = clean rounds. Wk1-2 steady, wk3 push the pace, wk4 easy. Not before a key rugby day.", [
    ex("swing", "AMRAP round · 12 · crisp, no slop"), ex("gsq", "AMRAP round · 10 full ROM"), ex("pushup", "AMRAP round · 10 chest-to-floor"), ex("suitcase", "AMRAP round · 20m/side tall"), ex("deadbug", "AMRAP round · 8/side"), ex("bearcrawl", "finisher · 2×15m slow, flat back"),
  ]),
  // 10. MOBILITY & YOGA FLOW — active range + recovery, daily-friendly
  pg("mobility", "Mobility & Own-the-Range", "Mobility", 8, 3, "sage",
    "~30 min · Own the range: pre-stretch → contract 5s in the stretch → lift actively out → load lightly → use it. Nasal breathing, everything slow. One steady round, no rest needed. Daily-friendly — great after hard sessions.", [
    ex("catcow", "flow · 8/side · move with the breath"), ex("ninety", "flow · 8/side slow"), ex("hipcars", "control · 3/dir · biggest circle"), ex("shouldercars", "control · 3/dir"),
    ex("deepsquat", "hold · 60s · pry + breathe"), ex("jeff", "loaded range · 6 light · 5s down"), ex("cossack", "loaded range · 6/side · sit in"), ex("wallslide", "shoulder · 8 · ribs down"),
    ex("deadbug", "brace · 8/side · slow exhale"), ex("hollow", "brace · 20s · ribs down"),
  ]),
];
