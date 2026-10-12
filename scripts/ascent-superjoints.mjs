// Super Joints (Pavel Tsatsouline) — daily joint-mobility complex + the drills
// it needs that weren't already in the library. Head-to-toe joint ROM, ~15-20
// reps/joint, done most days. Not stretching — joint lubrication/maintenance.
// videoUrl applied by load-content.mjs from the video maps (matched by name).
function mk(id, name, category, equipment, cues) {
  return { id: "ax-" + id, name, category, equipment, prescription: "see programme", cues, video: false, videoUrl: "" };
}

export const exercises = [
  mk("neck3plane", "Neck Mobility 3-Plane", "Mobility", "Bodyweight", ["Nod yes, tilt ear-to-shoulder, then turn side to side — slow and controlled.", "Move only to a comfortable end range; never force the neck."]),
  mk("egyptian", "The Egyptian", "Mobility", "Bodyweight", ["Arms out in a T; rotate the palms up/forward and down/back alternately.", "Pavel's shoulder-girdle drill — wring the shoulders through their range."]),
  mk("elbowcircles", "Elbow Circles", "Mobility", "Bodyweight", ["Upper arms still, circle the forearms at the elbows, both directions.", "Full controlled range, relaxed."]),
  mk("armcircles", "Arm Circles", "Mobility", "Bodyweight", ["Big controlled circles forwards then backwards, full shoulder range.", "Stand tall, open the chest, smooth tempo."]),
  mk("anklecircles", "Ankle Circles", "Mobility", "Bodyweight", ["Lift one foot, circle the ankle both directions through full range.", "Slow and deliberate; draw the biggest circle you can."]),
  mk("kneecircles", "Knee Circles", "Mobility", "Bodyweight", ["Feet together, soft knees, circle them gently both directions.", "Small controlled circles; keep the feet flat."]),
  mk("sidebend", "Standing Side Bend", "Mobility", "Bodyweight", ["Reach one arm overhead and bend sideways, long through the waist.", "No twisting or leaning forward — feel the side-body open."]),
  mk("torsotwist", "Standing Torso Twist", "Mobility", "Bodyweight", ["Feet planted, rotate the trunk side to side, arms relaxed and swinging.", "Let the spine rotate smoothly; keep the hips fairly still."]),
];

function ex(id, sets) { return { id: "ax-" + id, sets }; }
function pg(id, name, goal, weeks, frequency, colour, description, exercises) {
  return { id: "ap-" + id, name, goal, weeks, frequency, colour, description, exercises };
}

export const programmes = [
  pg("superjoints", "Super Joints · Daily Mobility", "Mobility", 12, 7, "light",
    "Pavel's daily joint-mobility complex — head to toe, ~15-20 reps per joint, 5-10 min. Lubricate every joint with smooth circles and calm breathing. This is joint ROM maintenance, not stretching — do it most days, even rest days.", [
    ex("neck3plane", "neck · 10-15 each plane"), ex("shouldercars", "shoulder circles · 10 each"), ex("egyptian", "shoulder girdle · 10 each"),
    ex("elbowcircles", "elbows · 15 each"), ex("wristprep", "wrists · 15 each"), ex("armcircles", "arms · 15 each"),
    ex("sidebend", "spine · 10 each side"), ex("torsotwist", "spine · 10 each side"), ex("hipcars", "hips · 10 each"),
    ex("kneecircles", "knees · 15 each"), ex("anklecircles", "ankles · 15 each"), ex("deepsquat", "hips/knees · 60s squat hold"),
  ]),
];
