// Ascent-based exercise library + 10 varied programmes for the supple club.
// videoUrl is filled in by load-content.mjs from the research agent's results
// (matched by exercise name). IDs are prefixed "ax-"/"ap-" so they never clash
// with anything already in the live club.

export const exercises = [
  // --- Lower body / hinge ---
  mk("sq", "Back Squat", "Lower body", "Barbell", "4 × 5", [
    "Brace 360° before you unrack — big breath into the belt line.",
    "Sit between the hips, knees track over toes, drive the floor apart.",
    "Own the bottom for a beat on tempo work, then stand tall.",
  ]),
  mk("gsq", "Goblet Squat", "Lower body", "Kettlebell", "3 × 8", [
    "Hold the bell tight to the chest, elbows inside the knees at the bottom.",
    "Sit down between the hips, heels planted, chest proud.",
    "Smooth down, strong up — control the eccentric.",
  ]),
  mk("rdl", "Romanian Deadlift", "Lower body", "Barbell", "3 × 8", [
    "Soft knees, push the hips back — feel the hamstrings lengthen.",
    "Bar stays close, shins vertical, long spine throughout.",
    "Own the long muscle length at the bottom, then squeeze the glutes to stand.",
  ]),
  mk("tbdl", "Trap-Bar Deadlift", "Lower body", "Trap bar", "4 × 4", [
    "Hips between a squat and a hinge, chest up, slack out of the bar.",
    "Push the floor away — drive through mid-foot.",
    "Lock out tall, don't lean back. Lower under control.",
  ]),
  mk("lunge", "Walking Lunge", "Lower body", "Dumbbells", "3 × 10 / side", [
    "Long step, tall torso, back knee kisses the floor.",
    "Drive through the front heel to stand and step through.",
    "Keep the hips level — no wobble.",
  ]),
  mk("bss", "Bulgarian Split Squat", "Lower body", "Dumbbells", "3 × 6 / side", [
    "Back foot on the bench, weight in the front leg.",
    "Drop straight down, front shin travels, torso slightly forward.",
    "Own the stretch at the bottom, drive up through the heel.",
  ]),
  mk("ht", "Barbell Hip Thrust", "Lower body", "Barbell", "3 × 10", [
    "Shoulder blades on the bench, chin tucked, ribs down.",
    "Drive through the heels, squeeze the glutes hard at the top.",
    "Full lockout — hips to a tabletop, then lower with control.",
  ]),
  mk("span", "Spanish Squat (isometric)", "Lower body", "Resistance band", "4 × 40s", [
    "Band around the knees anchored in front, sit back into it.",
    "Shins vertical, load the quads and the patellar tendon.",
    "Own the position — settle in and hold the dwell, breathe steady.",
  ]),
  mk("nordic", "Nordic Hamstring Curl", "Lower body", "Bodyweight", "3 × 5", [
    "Anchor the ankles, hips and shoulders in one line.",
    "Lower as slowly as you can control — fight gravity the whole way.",
    "Catch with the hands, push back up to the start.",
  ]),
  // --- Push ---
  mk("ohp", "Standing Overhead Press", "Upper body", "Barbell", "4 × 6", [
    "Stack the bar over mid-foot, squeeze glutes, ribs down.",
    "Press straight up, move the head back then through as the bar clears.",
    "Lock out with the biceps by the ears, bar over the crown.",
  ]),
  mk("floorpress", "Barbell Floor Press", "Upper body", "Barbell", "4 × 5", [
    "Lie flat, triceps touch the floor at the bottom — no bounce.",
    "Tuck the elbows ~45°, drive the bar up and slightly back.",
    "Great pressing strength without a bench.",
  ]),
  mk("pushup", "Push-Up", "Upper body", "Bodyweight", "3 × AMRAP", [
    "Hands under the shoulders, body one rigid line — brace the trunk.",
    "Lower under control, elbows ~45°, chest to the floor.",
    "Press the floor away, protract the shoulder blades at the top.",
  ]),
  // --- Pull ---
  mk("pullup", "Pull-Up", "Upper body", "Pull-up bar", "4 × 5", [
    "Start from a dead hang, shoulders active (down and back).",
    "Lead with the chest, pull the elbows to the ribs.",
    "Chin over the bar, lower all the way under control.",
  ]),
  mk("row", "Bent-Over Barbell Row", "Upper body", "Barbell", "4 × 8", [
    "Hinge to ~45°, long spine, bar hanging under the shoulders.",
    "Row to the lower ribs, squeeze the mid-back.",
    "Control the lower — no heave.",
  ]),
  mk("invrow", "Inverted Row", "Upper body", "Rings or bar", "4 × 10", [
    "Body rigid and straight, heels on the floor (or feet raised to progress).",
    "Pull the chest to the bar/rings, elbows to the ribs.",
    "Pause at the top, lower with control.",
  ]),
  // --- Kettlebell ---
  mk("swing", "Hardstyle Kettlebell Swing", "Full body", "Kettlebell", "10 × 10", [
    "Hike the bell back high between the thighs — it's a hinge, not a squat.",
    "Snap the hips through, glutes hard, bell floats to chest height.",
    "Sharp exhale and brace at the top; let it fall, catch with the hips.",
  ]),
  mk("kbcp", "Kettlebell Clean & Press", "Full body", "Kettlebell", "5 × 5 / side", [
    "Clean: zip the bell up the body, land soft in the rack — no bang.",
    "Rack tight: fist at the chest, elbow down, wrist straight.",
    "Press with a braced trunk, lock out overhead, lower to the rack.",
  ]),
  mk("tgu", "Turkish Get-Up", "Full body", "Kettlebell", "5 × 1 / side", [
    "Eyes on the bell the whole way up, wrist stacked over the elbow.",
    "Roll to elbow → hand → bridge → sweep the leg → lunge → stand.",
    "Slow and deliberate; reverse the exact same steps back down.",
  ]),
  // --- Plyometric / speed ---
  mk("pogo", "Pogo Jumps", "Conditioning", "Bodyweight", "4 × 10", [
    "Stiff ankles, bounce off the balls of the feet — minimal knee bend.",
    "Spend as little time on the ground as possible — think 'hot floor'.",
    "Tall and springy; it's an ankle/Achilles drill.",
  ]),
  mk("broad", "Broad Jump", "Conditioning", "Bodyweight", "4 × 3", [
    "Dip and swing the arms, drive the hips forward and out.",
    "Full triple extension — ankles, knees, hips.",
    "Land soft and balanced, reset each rep for quality.",
  ]),
  mk("box", "Box Jump", "Conditioning", "Plyo box", "4 × 3", [
    "Explode up, drive the knees, land soft and quiet on the box.",
    "Land in a quarter-squat — absorb, don't collapse.",
    "Step down (don't jump down) to save the tendons.",
  ]),
  mk("askip", "A-Skip", "Conditioning", "Bodyweight", "4 × 20 m", [
    "Tall posture, drive the knee up and the foot down under the hip.",
    "Quick ground contacts, dorsiflexed foot, rhythmic arms.",
    "It's about rhythm and stiffness, not height.",
  ]),
  // --- Gymnastic strength ---
  mk("hs", "Wall Handstand Hold", "Full body", "Wall", "5 × 30s", [
    "Chest-to-wall, hands a hand's-length off the skirting, stack tall.",
    "Posterior pelvic tilt, ribs down, push the floor away through the shoulders.",
    "Own the position — build the hold time before freestanding.",
  ]),
  mk("lsit", "L-Sit", "Core", "Parallettes or floor", "5 × 15s", [
    "Depress the shoulders, push down hard, lock the knees.",
    "Hollow the trunk, point the toes, lift the legs to the L.",
    "Regress to tuck or one-leg if the full L breaks position.",
  ]),
  mk("fl", "Tuck Front Lever", "Full body", "Pull-up bar", "5 × 10s", [
    "Straight arms, pull the bar towards the hips — lats drive the counter-lever.",
    "Tuck tight, flat back parallel to the floor, ribs down.",
    "Own the position; open the tuck gradually as you get stronger.",
  ]),
  mk("hollow", "Hollow Body Hold", "Core", "Bodyweight", "4 × 20s", [
    "Lower back pressed flat into the floor — no gap.",
    "Arms and legs extended, shoulders and heels just off the floor.",
    "Regress by tucking the knees or raising the arms.",
  ]),
  // --- Core / anti-movement ---
  mk("deadbug", "Dead Bug", "Core", "Bodyweight", "3 × 10", [
    "Ribs down, lower back glued to the floor, slow breathing.",
    "Extend opposite arm and leg, keep the trunk perfectly still.",
    "Exhale as you reach, move slow — quality over speed.",
  ]),
  mk("pallof", "Pallof Press", "Core", "Resistance band", "3 × 10 / side", [
    "Band at chest height from the side, stand tall and braced.",
    "Press straight out and resist the rotation — don't let it twist you.",
    "Hold at full extension, return with control.",
  ]),
  // --- Mobility / own-the-range ---
  mk("ninety", "90/90 Hip Switch", "Mobility", "Bodyweight", "3 × 8 / side", [
    "Both knees at 90°, sit tall, drive the back knee's glute to turn.",
    "Move slowly through the full range you own — no forcing.",
    "Keep the chest up; actively pull into each position.",
  ]),
  mk("jeff", "Jefferson Curl", "Mobility", "Light dumbbell", "3 × 6", [
    "Stand on a box, roll down one vertebra at a time, legs straight.",
    "Let the weight pull you into a loaded end-range — slow and controlled.",
    "Roll back up segment by segment. Start very light.",
  ]),
];

function mk(id, name, category, equipment, prescription, cues) {
  return { id: "ax-" + id, name, category, equipment, prescription, cues, video: false, videoUrl: "" };
}

// Helper to reference an exercise id inside a programme.
function ex(id, sets) {
  return { id: "ax-" + id, sets };
}

export const programmes = [
  pg("reset", "Reset & Mobilise", "Mobility", 6, 3, "light", "~30 min. Gentle re-entry — breathe, own your range, wake the tissues up. The day-one on-ramp.", [
    ex("ninety", "2 × 8 / side"), ex("deadbug", "3 × 8"), ex("jeff", "3 × 6 (light)"),
    ex("span", "3 × 30s"), ex("hollow", "3 × 20s"),
  ]),
  pg("tendon", "Tendon Rebuild", "Strength", 4, 3, "sage", "~45 min. Tissue-first loading for knees & Achilles. Slow tempo, own the position, build capacity.", [
    ex("span", "4 × 45s"), ex("nordic", "3 × 5 (slow)"), ex("gsq", "3 × 8 (3s down)"),
    ex("rdl", "3 × 8"), ex("pogo", "3 × 10 (if pain-free)"), ex("pallof", "3 × 10 / side"),
  ]),
  pg("platform", "Platform Strength", "Strength", 4, 3, "slate", "~55 min. Build the base — density + muscle. Controlled reps at ~2 reps in reserve.", [
    ex("sq", "4 × 6"), ex("ohp", "4 × 6"), ex("row", "4 × 8"), ex("rdl", "3 × 8"),
    ex("lunge", "3 × 10 / side"), ex("pushup", "3 × AMRAP"), ex("deadbug", "3 × 10"),
  ]),
  pg("triphasic", "Triphasic Strength", "Strength", 3, 3, "dark", "~60 min. Eccentric → isometric → concentric. Heavier loads, full recovery between sets.", [
    ex("sq", "5 × 4 (tempo)"), ex("floorpress", "4 × 5"), ex("tbdl", "4 × 4"),
    ex("pullup", "4 × 5"), ex("bss", "3 × 6 / side"), ex("span", "3 × 40s"),
  ]),
  pg("power", "Power & Speed", "Power", 3, 3, "stone", "~55 min. Contrast pairs + acceleration. Explosive intent, 95%+ recovery, quality over fatigue.", [
    ex("sq", "4 × 3 (heavy, pair w/ broad jump)"), ex("broad", "4 × 3"), ex("box", "4 × 3"),
    ex("askip", "4 × 20 m"), ex("pogo", "4 × 10"), ex("swing", "5 × 10"), ex("ohp", "3 × 5"),
  ]),
  pg("kb", "Kettlebell Strong", "Strength", 6, 3, "", "~45 min. Pavel hardstyle — hinge power, grind strength and grip. Minimal kit, maximal carry-over.", [
    ex("swing", "10 × 10 (on the minute)"), ex("tgu", "5 × 1 / side"), ex("kbcp", "5 × 5 / side"),
    ex("gsq", "4 × 8"), ex("invrow", "4 × 10"),
  ]),
  pg("gym", "Gymnastic Strength", "Strength", 6, 3, "slate", "~50 min. Straight-arm & bodyweight mastery. Own the position — dwell before you add reps.", [
    ex("hs", "5 × 30s"), ex("lsit", "5 × 15s"), ex("fl", "5 × 10s"),
    ex("pushup", "4 × 10"), ex("invrow", "4 × 8"), ex("hollow", "4 × 20s"),
  ]),
  pg("exstr", "Express Strength", "Strength", 4, 4, "dark", "~25 min. Short on time? Three big lifts, in and out. Full-body stimulus, minimal fuss.", [
    ex("gsq", "3 × 8"), ex("floorpress", "3 × 8"), ex("rdl", "3 × 8"),
  ]),
  pg("excon", "Express Conditioning", "Conditioning", 4, 3, "stone", "~25 min. A quick engine hit — full-body intervals as a circuit. Move, breathe, repeat.", [
    ex("swing", "6 × 15"), ex("pushup", "6 × 10"), ex("lunge", "6 × 10 / side"),
  ]),
  pg("mobility", "Mobility & Own-the-Range", "Mobility", 8, 3, "sage", "~30 min. Active range, loaded end-range and breathing. Keep everyday movement feeling good.", [
    ex("ninety", "3 × 8 / side"), ex("jeff", "3 × 6"), ex("span", "3 × 30s"),
    ex("deadbug", "3 × 10"), ex("hollow", "3 × 20s"),
  ]),
];

function pg(id, name, goal, weeks, frequency, colour, description, exercises) {
  return { id: "ap-" + id, name, goal, weeks, frequency, colour, description, exercises };
}
