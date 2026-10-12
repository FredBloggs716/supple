// General library expansion — more variations per pattern, Olympic lifts,
// plyos, sprint/agility/rugby transfer, conditioning tools, carries, mobility.
// videoUrl applied by load-content.mjs from the video maps (matched by name).
function mk(id, name, category, equipment, cues) {
  return { id: "ax-" + id, name, category, equipment, prescription: "see programme", cues, video: false, videoUrl: "" };
}

export const exercises = [
  // Squat / hinge variations
  mk("deadlift", "Conventional Deadlift", "Lower body", "Barbell", ["Bar over mid-foot, take the slack out, chest up.", "Push the floor away; bar drags up the legs, lock out tall."]),
  mk("slrdl", "Single-Leg RDL", "Lower body", "DB/KB", ["Hinge over one leg, back leg extends as a counterweight.", "Hips square, long spine; drive the hip through to stand."]),
  mk("goodmorning", "Good Morning", "Lower body", "Barbell", ["Soft knees, push the hips back, bar on the back.", "Long spine throughout; hamstrings drive you back up."]),
  mk("kbdl", "Kettlebell Deadlift", "Lower body", "Kettlebell", ["Hinge to the bell between the heels, flat back.", "Stand tall squeezing the glutes; a great hinge primer."]),
  mk("boxsquat", "Box Squat", "Lower body", "Barbell", ["Sit back to the box under control, shins vertical.", "Stay tight on the box, then drive up explosively."]),
  mk("pistol", "Pistol Squat", "Lower body", "Bodyweight", ["One leg out front, sit all the way down under control.", "Heel down, chest up; regress to a box or assisted."]),
  mk("backext", "Back Extension", "Lower body", "45° bench", ["Hinge at the hips, long spine, squeeze glutes to rise.", "Don't hyperextend the lower back at the top."]),
  mk("walklunge", "Walking Lunge", "Lower body", "Dumbbells", ["Long step, tall torso, back knee kisses the floor.", "Drive through the front heel to step through."]),
  mk("curtsy", "Curtsy Lunge", "Lower body", "Bodyweight/DB", ["Step the back leg diagonally behind, drop straight down.", "Hips square, knee tracks over the toes."]),
  mk("skater", "Skater Squat", "Lower body", "Bodyweight", ["Single-leg, back knee reaches to the floor behind.", "Chest forward as a counterweight; control the lower."]),
  mk("peterson", "Peterson Step-Up", "Lower body", "Box", ["Up on the ball of the foot, drive tall, knee over toes.", "Slow down — biases the VMO and patellar tendon."]),
  // Push
  mk("bench", "Barbell Bench Press", "Upper body", "Barbell", ["Shoulder blades retracted, feet planted, slight arch.", "Bar to the lower chest, elbows ~45°, drive up."]),
  mk("inclinedb", "Incline Dumbbell Press", "Upper body", "Dumbbells", ["Bench ~30°, lower the dumbbells to the upper chest.", "Press up and slightly together; control the stretch."]),
  mk("dip", "Dip", "Upper body", "Parallel bars", ["Lean slightly forward, lower under control to ~90°.", "Keep the shoulders down; press to a strong lockout."]),
  mk("landmine", "Landmine Press", "Upper body", "Landmine", ["Press the bar up and forward on the arc, ribs down.", "Shoulder-friendly; brace the trunk."]),
  mk("pushpress", "Push Press", "Upper body", "Barbell", ["Short dip with the legs, drive the bar off the shoulders.", "Punch under to lock out; one smooth leg-driven press."]),
  // Pull
  mk("chinup", "Chin-Up", "Upper body", "Bar", ["Supinated grip, lead with the chest, pull elbows down.", "Chin over the bar, full controlled lower."]),
  mk("latpull", "Lat Pulldown", "Upper body", "Cable", ["Chest up, pull the bar to the collarbone, elbows down.", "Control the return; no leaning back to heave."]),
  mk("dbrow", "Single-Arm Dumbbell Row", "Upper body", "Dumbbell", ["Flat back, row the DB to the hip, squeeze the lat.", "No torso rotation; control the lower."]),
  mk("csrow", "Chest-Supported Row", "Upper body", "Bench/DB", ["Chest on the incline bench, row to the ribs.", "Removes momentum; squeeze the mid-back."]),
  mk("facepull", "Face Pull", "Upper body", "Cable/band", ["Pull to the face, elbows high, externally rotate.", "Great for shoulder health and posture."]),
  mk("pendlay", "Pendlay Row", "Upper body", "Barbell", ["Flat back parallel to the floor, bar from the dead stop.", "Explosive row to the lower chest, reset each rep."]),
  // Olympic / power
  mk("powerclean", "Power Clean", "Full body", "Barbell", ["Explosive triple extension, shrug and pull under.", "Catch in a quarter squat, elbows fast and high."]),
  mk("pushjerk", "Push Jerk", "Full body", "Barbell", ["Dip-drive the bar up, drop under into a quarter squat.", "Lock out overhead, then stand; punch the bar up."]),
  mk("dbsnatch", "Dumbbell Snatch", "Full body", "Dumbbell", ["Hinge, explosive pull, punch the DB overhead in one move.", "Lock out tall; control it down."]),
  // Plyometric
  mk("depthjump", "Depth Jump", "Conditioning", "Box", ["Step off, land and rebound as fast as possible.", "Minimal ground contact; advanced plyo — tendons ready."]),
  mk("tuckjump", "Tuck Jump", "Conditioning", "Bodyweight", ["Jump and drive the knees to the chest, land soft.", "Quiet landings; quality reps."]),
  mk("bound", "Bounding", "Conditioning", "Bodyweight", ["Exaggerated running leaps, drive the knee and arms.", "Big air time, stick each landing; elastic power."]),
  // Speed / agility / rugby transfer
  mk("walldrill", "Sprint Wall Drill", "Conditioning", "Wall", ["Lean on the wall at a sprint angle, drive one knee up.", "Punch the foot down under the hip; teaches acceleration."]),
  mk("sled", "Sled Push", "Conditioning", "Sled", ["Low body lean, powerful alternating leg drive.", "Full extension each step; low-impact force production."]),
  mk("decelstick", "Deceleration Stick", "Conditioning", "Bodyweight", ["Run in, drop the hips and STICK the stop on one leg.", "Absorb the force, hold the position — braking skill."]),
  mk("codcut", "Change of Direction Cut", "Conditioning", "Bodyweight", ["Plant the outside foot, drop the hips, push off hard.", "Low and balanced; re-accelerate out of the cut."]),
  mk("neckiso", "Neck Isometrics", "Full body", "Hand/band", ["Press the head into the hand in each direction, hold.", "Build neck resilience for contact; no sudden force."]),
  // Conditioning tools
  mk("bike", "Assault Bike Intervals", "Conditioning", "Air bike", ["Drive arms and legs together, settle into a pace.", "Great low-impact intervals; pick a hard:easy ratio."]),
  mk("rowerg", "Row Erg Intervals", "Conditioning", "Rower", ["Legs → hips → arms on the drive; arms → hips → legs back.", "Strong leg drive; controlled recovery."]),
  mk("wallball", "Wall Ball", "Conditioning", "Med ball", ["Squat, then drive up and throw to the target.", "Catch and absorb into the next squat; full extension."]),
  mk("burpee", "Burpee", "Conditioning", "Bodyweight", ["Chest to floor, jump the feet in, stand and hop.", "Keep a smooth rhythm; brace on the way down."]),
  // Core / carry
  mk("abwheel", "Ab Wheel Rollout", "Core", "Ab wheel", ["Ribs down, roll out as far as you can hold the brace.", "No lower-back sag; pull back with the abs."]),
  mk("hlr", "Hanging Leg Raise", "Core", "Bar", ["Dead hang, posterior tilt, raise the legs with control.", "No swinging; lower slowly."]),
  mk("frontcarry", "Front Rack Carry", "Full body", "KB/DB", ["Weights in the rack, elbows down, ribs stacked.", "Tall posture, braced; breathe and walk."]),
  mk("ohcarry", "Overhead Carry", "Full body", "KB/DB", ["Lock the weight overhead, biceps by the ear, ribs down.", "Walk tall and stable; shoulder stability under load."]),
  // Mobility / recovery
  mk("couch", "Couch Stretch", "Mobility", "Wall", ["Back foot up the wall, square the hips, squeeze the glute.", "Tall torso; opens the hip flexor and quad."]),
  mk("pigeon", "Pigeon Stretch", "Mobility", "Bodyweight", ["Front shin across, hips square, sink forward.", "Breathe into the glute; keep it pain-free."]),
  mk("thread", "Thread the Needle", "Mobility", "Bodyweight", ["On all fours, thread one arm under, rotate the mid-back.", "Then reach up and open; follow the hand with the eyes."]),
  mk("hipairplane", "Hip Airplane", "Mobility", "Bodyweight", ["Hinge on one leg, rotate the pelvis open and closed.", "Control the rotation; superb hip stability drill."]),
];
