// Gymnastics-strength library + progression programmes (Overcoming Gravity /
// Sommer method): wrist prep first, static holds at the hardest CLEAN variation
// (~10-15s, accumulate sets), dynamic strength 2-3x3-5, progress by LEVERAGE.
// Handstand B/I/A + Gymnastic Strength L1-L5. videoUrl applied by load-content.mjs.
function mk(id, name, category, equipment, cues) {
  return { id: "ax-" + id, name, category, equipment, prescription: "see programme", cues, video: false, videoUrl: "" };
}

export const exercises = [
  // Handstand line
  mk("wristprep", "Wrist Prep for Gymnastics", "Mobility", "Bodyweight", ["Load the wrists gently in every direction before hand-balancing.", "Fingers forward/back/sideways, rock and circle. Non-negotiable warm-up."]),
  mk("c2wall", "Chest-to-Wall Handstand", "Full body", "Wall", ["Walk up facing the wall, hands close, stack tall.", "Posterior tilt, ribs down, push the floor away — build the line + time."]),
  mk("b2wall", "Back-to-Wall Handstand", "Full body", "Wall", ["Kick up back-to-wall, then walk the hands in and pull the heels off.", "Find the balance line; ribs down, straight body."]),
  mk("wallwalk", "Wall Walk", "Full body", "Wall", ["Feet on the wall, walk the hands in towards it, hips stacking.", "Controlled in and out; builds shoulder strength + comfort inverted."]),
  mk("kickup", "Handstand Kick-Up", "Full body", "Wall/floor", ["One leg plants, the other kicks up to balance over the hands.", "Light kick — aim to float, not crash. Learn a safe bail/pirouette out."]),
  mk("freehs", "Freestanding Handstand", "Full body", "Bodyweight", ["Stack the whole body, balance with the fingertips, not the shoulders.", "Small corrections; ribs down, legs squeezed, toes pointed."]),
  mk("pikepress", "Pike Press to Handstand", "Full body", "Bodyweight", ["Lean the shoulders forward over the hands, lift the hips, pike up.", "Straight arms, compressed pike; use wall/negatives to build it."]),
  mk("straddlepress", "Straddle Press to Handstand", "Full body", "Bodyweight", ["Straddle the legs, lean, lift the hips over the hands, close to the line.", "Straight-arm strength + compression; negatives first."]),
  mk("pikepush", "Pike Push-Up", "Upper body", "Bodyweight", ["Hips high in a pike, lower the crown of the head towards the floor.", "Press back up; the shoulder-press builder for HSPU."]),
  mk("wallhspu", "Wall Handstand Push-Up", "Upper body", "Wall", ["Back-to-wall handstand, lower the head to the floor under control.", "Press to lockout; start with negatives and partial range."]),
  // Straight-arm / scapular base
  mk("archhold", "Arch Body Hold", "Core", "Bodyweight", ["Face down, lift the chest, arms and legs off the floor.", "Squeeze the glutes and back; the antagonist to the hollow."]),
  mk("hollowrock", "Hollow Body Rock", "Core", "Bodyweight", ["Hold the hollow, then rock from shoulders to hips as one rigid unit.", "Lower back stays glued; no breaking at the hips."]),
  mk("scappull", "Scapular Pull", "Upper body", "Bar", ["Dead hang with straight arms, pull the shoulders down and back.", "Shoulder blades do the work; the base of every pull."]),
  mk("support", "Support Hold", "Upper body", "Parallettes/bars", ["Arms locked, shoulders down, body tall and hollow over the hands.", "Builds straight-arm support strength; progress to rings."]),
  mk("shoulderext", "Seated Shoulder Extension Stretch", "Mobility", "Floor/bench", ["Sit with hands behind you, fingers back; slide the hips forward.", "Open the front of the shoulders gently — a seated prep, no bodyweight hang. The beginner-friendly shoulder opener before levers."]),
  mk("germanhang", "German Hang", "Upper body", "Rings/bar", ["Hang through into a shoulder-extension stretch, straight arms.", "Builds shoulder mobility + strength for levers; ease in slowly (intermediate+)."]),
  mk("skincat", "Skin the Cat", "Upper body", "Rings/bar", ["From a tuck inversion, roll through to the German hang and back.", "Straight-arm control through the full shoulder range."]),
  // Planche line (push)
  mk("ppp", "Pseudo Planche Push-Up", "Upper body", "Bodyweight", ["Hands by the hips, lean the shoulders far forward over them.", "Straight-arm lean + push; the gateway to the planche."]),
  mk("planchelean", "Planche Lean", "Upper body", "Bodyweight", ["Plank on the hands, lean the shoulders forward past the wrists.", "Protract and depress; hold the hardest lean you can own."]),
  mk("tuckplanche", "Tuck Planche", "Full body", "Parallettes", ["Lean forward, lift the feet, knees tucked, straight arms.", "Protract hard, hips up; progress by opening the tuck."]),
  mk("straddleplanche", "Straddle Planche", "Full body", "Parallettes", ["From advanced tuck, open the legs to straddle, body parallel.", "Straight arms, full protraction; the hardest hold you can keep clean."]),
  // Front lever line (pull)
  mk("advtuckfl", "Advanced Tuck Front Lever", "Full body", "Bar", ["Tuck front lever with the back flat and hips opened further.", "Straight arms, lats pull the bar to the hips; ribs down."]),
  mk("straddlefl", "Straddle Front Lever", "Full body", "Bar", ["Open the legs wide, body parallel to the floor, straight arms.", "Lats + straight-arm pull; shorten the lever by narrowing later."]),
  mk("fullfl", "Full Front Lever", "Full body", "Bar", ["Whole body one straight horizontal line, straight arms.", "Max straight-arm pull; hold the cleanest few seconds you own."]),
  mk("flrow", "Front Lever Row", "Full body", "Bar", ["From a front-lever position, pull the body to the bar.", "Dynamic lever strength; keep the body flat and rigid."]),
  // Back lever line
  mk("tuckbl", "Tuck Back Lever", "Full body", "Rings/bar", ["Inverted, lower to horizontal with knees tucked, straight arms.", "Shoulders and biceps loaded — ease in; builds the straight-arm base."]),
  mk("straddlebl", "Straddle Back Lever", "Full body", "Rings/bar", ["Open the tuck to straddle, body horizontal and face-down.", "Straight arms, controlled; progress by closing to full."]),
  // Rings / dynamic
  mk("ringdip", "Ring Dip", "Upper body", "Rings", ["Support hold, lower under control, rings close to the body.", "Press to a strong lockout; turn the rings out at the top (RTO)."]),
  mk("ringsupport", "Ring Support Hold", "Upper body", "Rings", ["Lock the arms, press down, turn the rings out, body hollow.", "Fight the instability; the foundation of all ring strength."]),
  mk("muscleup", "Muscle-Up", "Full body", "Bar/rings", ["Explosive pull to the chest, fast transition over the bar/rings.", "Then press out; build with high pull-ups + transition drills."]),
];

function ex(id, sets) { return { id: "ax-" + id, sets }; }
function pg(id, name, goal, weeks, frequency, colour, description, exercises) {
  return { id: "ap-" + id, name, goal, weeks, frequency, colour, description, exercises };
}

export const programmes = [
  // HANDSTAND — Beginner / Intermediate / Advanced
  pg("hs1", "Handstand · Foundations (Beginner)", "Handstand", 8, 4, "slate",
    "~30 min, 4×/wk. WRIST PREP first, every session. Build a straight hollow line + chest-to-wall hold time. Hold the cleanest position you can, accumulate sets. Goal: 60s chest-to-wall. Little and often beats one long grind.", [
    ex("wristprep", "warm-up · 5 min · all directions"), ex("hollow", "line · 4×20s · rest 40s · ribs down"), ex("archhold", "line · 4×20s · rest 40s"),
    ex("c2wall", "holds · 5×max CLEAN · rest 90s · goal 60s total"), ex("wallwalk", "strength · 3×3-5 slow · rest 60-90s"), ex("kickup", "skill · 10 light tries + safe bail · rest as needed"),
    ex("pikepush", "press · 3×6-10 @ 2-0-1 · rest 60-90s"), ex("hollowrock", "core · 3×10 · steady rhythm"),
  ]),
  pg("hs2", "Handstand · Balance (Intermediate)", "Handstand", 8, 4, "slate",
    "~35 min, 4×/wk. Wrist prep first. Off the wall now — heel pulls, freestanding kick-up + safe bail, balance reps with fingertip corrections. Goal: 5-10s freestanding. Volume of attempts is the skill.", [
    ex("wristprep", "warm-up · 5 min"), ex("b2wall", "balance · 5× heel-pull holds · rest 60-90s"), ex("kickup", "to freestanding · 15 tries · rest ~30s each"),
    ex("freehs", "balance · many short tries, stop while fresh"), ex("wallhspu", "strength · 3×3-5 negatives @ 3-5s down · rest 2min"), ex("pikepress", "wall drills · 3×3-5 slow · rest 90s"),
    ex("hollow", "line · 3×30s · rest 45s"),
  ]),
  pg("hs3", "Handstand · Mastery (Advanced)", "Handstand", 8, 4, "dark",
    "~40 min, 4×/wk. Wrist prep first. Freestanding time + press progressions + strict HSPU + one-arm prep (weight shifts). Goal PER CYCLE: +10-15s freestanding, press negatives closer to full, +1 HSPU rep. Mastery (30s+ free, full press, strict HSPU) takes months — repeat the block, progress each run.", [
    ex("wristprep", "warm-up · 5 min"), ex("freehs", "holds · accumulate time + weight shifts · rest fully"), ex("pikepress", "press · 4×3-5 slow · rest 2min"),
    ex("straddlepress", "press · 4×3-5 negatives→full · rest 2min"), ex("wallhspu", "HSPU · 4×3-5 @ 3s down · rest 2min"), ex("hollowrock", "core · 3×12 rhythm"),
  ]),
  // GYMNASTIC STRENGTH — Levels 1-5
  pg("gym1", "Gymnastic Strength · L1 Foundations", "Gymnastic strength", 8, 3, "slate",
    "~45 min. WRIST PREP first. Build the straight-arm base + hollow/arch line + support. Static holds: hardest CLEAN variation ~10-15s, accumulate sets. Dynamic 2-3×3-5. Progress the leverage, not just the time.", [
    ex("wristprep", "warm-up · 5 min"), ex("hollow", "line · 4×20-30s · rest 45s"), ex("archhold", "line · 4×20s · rest 40s"), ex("scappull", "scap · 3×8 slow, full hang · rest 60s"),
    ex("support", "hold · 4×20-30s · rest 60s · shoulders down"), ex("lsit", "holds · 5×max clean (tuck→one-leg) · rest 90s"), ex("invrow", "pull · 3×8-10 @ 2-0-1 · rest 60s"), ex("pushup", "push · 3×10-15 @ 2-0-1 · rest 60s"), ex("shoulderext", "shoulder prep · 3×20-30s easy, breathe"),
  ]),
  pg("gym2", "Gymnastic Strength · L2 Builder", "Gymnastic strength", 8, 3, "slate",
    "~50 min. Wrist prep first. Own full L-sit + tuck front lever + pseudo-planche. Antagonist balance: planche-line push vs front-lever-line pull. Steady-state — advance the variation when the sets feel strong.", [
    ex("wristprep", "warm-up · 5 min"), ex("lsit", "holds · 5×15s (→full L) · rest 60-90s"), ex("fl", "tuck FL · 5×10s clean · rest 90s"), ex("ppp", "push · 4×5-8 · big lean · rest 90s"),
    ex("pullup", "pull · 3×5 full ROM · rest 90s"), ex("dip", "push · 3×6-8 @ 2-0-1 · rest 90s"), ex("skincat", "straight-arm · 3×3-5 slow · ease in"), ex("tuckbl", "hold · 4×10s · rest 90s · ease shoulders in"),
  ]),
  pg("gym3", "Gymnastic Strength · L3 Developer", "Gymnastic strength", 8, 3, "dark",
    "~50 min. Wrist prep first. Advanced-tuck front lever, tuck planche, and the rings (support + dips). Short clean holds; progress the leverage. Rings add instability — earn them before loading.", [
    ex("wristprep", "warm-up · 5 min"), ex("advtuckfl", "holds · 5×10s clean · rest 90s"), ex("tuckplanche", "holds · 5×10s · rest 90s-2min"), ex("ringsupport", "RTO hold · 4×20-30s · rest 90s"),
    ex("ringdip", "push · 3×5-8 controlled · rest 90s"), ex("straddlebl", "hold · 4×10s · rest 90s"), ex("flrow", "pull · 3×5 crisp · rest 90s"),
  ]),
  pg("gym4", "Gymnastic Strength · L4 Strength", "Gymnastic strength", 6, 3, "dark",
    "~55 min. Wrist prep first. Straddle front lever + straddle planche + front-lever rows + HSPU + muscle-up. Elite straight-arm strength — pristine form or regress. Hold the cleanest few seconds you own. These holds take months: run the block back-to-back, progressing leverage a notch per cycle.", [
    ex("wristprep", "warm-up · 5 min"), ex("straddlefl", "holds · 5×8-10s · rest 2min"), ex("straddleplanche", "holds · 5×8-10s · rest 2min"), ex("flrow", "pull · 4×5 · body flat · rest 2min"),
    ex("wallhspu", "push · 4×5 @ 3s down · rest 2min"), ex("muscleup", "dynamic · 4×2-3 fresh + explosive · rest 2min"), ex("germanhang", "shoulder · 3×30s easy"),
  ]),
  pg("gym5", "Gymnastic Strength · L5 Elite", "Gymnastic strength", 6, 3, "dark",
    "~55 min. Wrist prep first. Full front lever + planche work + lever/planche pulls + one-arm prep. The top of the ladder — built over months of consistent, clean holds; repeat the block as many cycles as it takes. Quality is everything.", [
    ex("wristprep", "warm-up · 5 min"), ex("fullfl", "holds · 5×max clean line · rest 2-3min"), ex("straddleplanche", "holds · 5×max (→full) · rest 2-3min"), ex("flrow", "pull · 5×3-5 · rest 2min"),
    ex("muscleup", "dynamic · 5×2-3 strict-ish · rest 2min"), ex("ringsupport", "RTO hold · 4×30s · rest 90s"), ex("pullup", "weighted · 4×5 · rest 2min"),
  ]),
];
