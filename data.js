export const dayKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const offsetDay = (base, n) => {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const mondayOf = (day) => {
  const d = new Date(day + "T12:00:00");
  return offsetDay(day, -((d.getDay() + 6) % 7));
};
export const TODAY = dayKey();
const exerciseSeeds = [
  [
    "Back squat",
    "Lower body",
    "Barbell",
    "4 × 5",
    "Brace your trunk before each rep.",
    "Sit down between your hips with heels grounded.",
    "Stand tall, driving through the whole foot.",
  ],
  [
    "Romanian deadlift",
    "Lower body",
    "Barbell",
    "3 × 8",
    "Keep a soft bend in your knees.",
    "Push your hips back, keeping the bar close.",
    "Squeeze your glutes to return to standing.",
  ],
  [
    "Bench press",
    "Upper body",
    "Barbell",
    "4 × 6",
    "Keep your feet planted and shoulder blades set.",
    "Lower the bar under control to your chest.",
    "Press up smoothly without losing your position.",
  ],
  [
    "Goblet squat",
    "Lower body",
    "Dumbbell",
    "3 × 10",
    "Hold the weight close to your chest.",
    "Lower between your hips, keeping heels down.",
    "Exhale as you stand back up.",
  ],
  [
    "Single-arm row",
    "Upper body",
    "Dumbbell",
    "3 × 10",
    "Support yourself with one hand on a bench.",
    "Pull the weight towards your hip.",
    "Lower slowly without rotating your torso.",
  ],
  [
    "Farmer carry",
    "Full body",
    "Dumbbell",
    "3 × 40 m",
    "Pick a load you can carry with good posture.",
    "Stand tall and keep your ribs down.",
    "Walk with controlled, even steps.",
  ],
  [
    "Dead bug",
    "Core",
    "Bodyweight",
    "3 × 10",
    "Lie on your back with knees and arms raised.",
    "Keep your lower back gently against the floor.",
    "Extend opposite arm and leg, then alternate.",
  ],
  [
    "Split squat",
    "Lower body",
    "Dumbbell",
    "3 × 8",
    "Take a comfortable staggered stance.",
    "Lower your back knee towards the floor.",
    "Push through your front foot to stand.",
  ],
  [
    "Rowing intervals",
    "Conditioning",
    "Rower",
    "6 × 250 m",
    "Set your feet securely and choose a comfortable resistance.",
    "Drive with your legs, then hips, then arms.",
    "Recover in the opposite order with a relaxed grip.",
  ],
  [
    "Hip mobility flow",
    "Mobility",
    "Bodyweight",
    "3 × 60 s",
    "Move between 90/90 hip positions slowly.",
    "Keep your torso tall and use support if needed.",
    "Stay within a comfortable range and breathe evenly.",
  ],
  [
    "Lat pulldown",
    "Upper body",
    "Cable",
    "3 × 12",
    "Set the thigh pad and choose a controlled load.",
    "Pull your elbows towards your ribs.",
    "Return the bar slowly, keeping your trunk still.",
  ],
  [
    "Side plank",
    "Core",
    "Bodyweight",
    "3 × 30 s",
    "Stack your elbow under your shoulder.",
    "Lift your hips and keep a straight line.",
    "Breathe steadily; use a bent-knee version if needed.",
  ],
];
export function seedData() {
  const names = [
    "Jess Williams",
    "Sam Carter",
    "Alex Morgan",
    "Priya Shah",
    "Tom Wilson",
    "Ellie Parker",
    "James Taylor",
    "Mia Johnson",
    "Ben Clarke",
    "Sophie Evans",
    "Oliver Reed",
    "Hannah Green",
  ];
  const attendance = [5, 4, 3, 4, 2, 3, 2, 3, 2, 1, 2, 2];
  const adherence = [100, 92, 83, 96, 67, 92, 83, 100, 75, 83, 92, 83];
  const colours = [
    "warm",
    "blue",
    "sage",
    "lilac",
    "blue",
    "pink",
    "sage",
    "warm",
    "lilac",
    "pink",
    "blue",
    "sage",
  ];
  const exercises = exerciseSeeds.map((e, i) => ({
    id: "e" + i,
    name: e[0],
    category: e[1],
    equipment: e[2],
    prescription: e[3],
    cues: e.slice(4),
    video: false,
  }));
  const programmeSeeds = [
    [
      "Strong foundations",
      "Strength",
      8,
      3,
      [0, 1, 4, 6],
      "Build confidence with the lifts that matter. A steady start, with room to grow.",
      "",
    ],
    [
      "The strength block",
      "Strength",
      12,
      4,
      [0, 2, 1, 10],
      "Progressive loading, thoughtful recovery. Make your next personal best a repeatable one.",
      "dark",
    ],
    [
      "Move well",
      "Mobility",
      6,
      3,
      [9, 6, 7, 11],
      "A little more range. A little less stiffness. Keep everyday movement feeling good.",
      "light",
    ],
    [
      "Engine room",
      "Conditioning",
      6,
      3,
      [8, 3, 5, 6],
      "Build a bigger engine with balanced intervals and full-body training.",
      "slate",
    ],
    [
      "Everyday strong",
      "Strength",
      8,
      3,
      [3, 4, 7, 5],
      "Simple, repeatable sessions that fit around a busy life.",
      "sage",
    ],
    [
      "The club circuit",
      "Conditioning",
      4,
      2,
      [8, 5, 3, 11],
      "Train together. Keep each other going. A fresh full-body session for the club.",
      "stone",
    ],
  ];
  const programmes = programmeSeeds.map((p, i) => ({
    id: "p" + i,
    name: p[0],
    goal: p[1],
    weeks: p[2],
    frequency: p[3],
    exercises: p[4].map((id) => ({
      id: "e" + id,
      sets: exercises[id].prescription,
    })),
    description: p[5],
    colour: p[6],
  }));
  const clients = names.map((name, i) => ({
    id: "c" + i,
    name,
    email: name.toLowerCase().replace(" ", ".") + "@example.com",
    colour: colours[i],
    programme: "p" + (i % 6),
    goal: ["Build strength", "Improve fitness", "Move with confidence"][i % 3],
    adherence: adherence[i],
    streak: [8, 6, 4, 7, 3, 5, 3, 6, 2, 2, 4, 3][i],
    status: [2, 4, 9].includes(i) ? "Needs attention" : "On track",
    checkin: [2, 4, 9].includes(i)
      ? [
          "Training felt good this week. Could we review the load for my next session?",
          "A busy week at work. I missed a session but I am ready to pick things up again.",
          "Energy has been a little lower this week. Can we talk through my routine?",
        ][[2, 4, 9].indexOf(i)]
      : null,
    notes: [],
    targets: {
      calories: 2200 + (i % 3) * 100,
      protein: 140 + (i % 3) * 10,
      carbs: 260,
      fat: 70,
    },
    joined: offsetDay(TODAY, -56 - i * 5),
  }));
  const week = mondayOf(TODAY);
  const logs = [];
  for (let w = 7; w >= 0; w--) {
    clients.forEach((c, i) => {
      const count =
        w === 0
          ? attendance[i]
          : Math.max(
              1,
              attendance[i] - Math.floor(w / 3) + (i % 3 === w % 3 ? 1 : 0),
            );
      for (let j = 0; j < count; j++) {
        logs.push({
          id: `seed-${w}-${i}-${j}`,
          client: c.id,
          date: offsetDay(
            week,
            -w * 7 +
              Math.min(
                j,
                new Date(TODAY + "T12:00:00").getDay() === 0
                  ? 6
                  : new Date(TODAY + "T12:00:00").getDay() - 1,
              ),
          ),
          type: "Training",
          programme: c.programme,
        });
      }
    });
  }
  const measures = [];
  clients.forEach((c, i) => {
    for (let w = 7; w >= 0; w--) {
      measures.push({
        id: `m-${i}-${w}`,
        client: c.id,
        date: offsetDay(week, -w * 7),
        kind: "Deadlift",
        value:
          [110, 145, 90, 105, 130, 85, 155, 95, 120, 70, 140, 80][i] - w * 2.5,
      });
      measures.push({
        id: `b-${i}-${w}`,
        client: c.id,
        date: offsetDay(week, -w * 7),
        kind: "Body weight",
        value: Math.round((62 + i * 2.8 + w * 0.25) * 10) / 10,
      });
    }
    measures.push({
      id: `r-${i}`,
      client: c.id,
      date: week,
      kind: "2 km row",
      value: 450 + i * 9,
    });
  });
  const sessions = [
    {
      id: "s0",
      name: "Strength foundations",
      time: "07:00",
      duration: 45,
      clients: ["c0", "c1", "c3"],
      date: TODAY,
      coach: "Dean",
      status: "Scheduled",
      type: "Small group",
    },
    {
      id: "s1",
      name: "Personal training",
      time: "10:00",
      duration: 60,
      clients: ["c2"],
      date: TODAY,
      coach: "Dean",
      status: "Scheduled",
      type: "1-to-1",
    },
    {
      id: "s2",
      name: "The club circuit",
      time: "17:30",
      duration: 45,
      clients: ["c4", "c5", "c6", "c7"],
      date: TODAY,
      coach: "Dean",
      status: "Scheduled",
      type: "Small group",
    },
    {
      id: "s3",
      name: "Strength foundations",
      time: "07:00",
      duration: 45,
      clients: ["c0", "c1"],
      date: offsetDay(TODAY, 2),
      coach: "Dean",
      status: "Scheduled",
      type: "Small group",
    },
    {
      id: "s4",
      name: "Move well",
      time: "18:00",
      duration: 45,
      clients: ["c8", "c9"],
      date: offsetDay(TODAY, 1),
      coach: "Dean",
      status: "Scheduled",
      type: "Small group",
    },
  ];
  return {
    version: 1,
    settings: {
      coach: "Dean Mitchell",
      club: "Social Training Club",
      email: "dean@example.com",
      checkinAlerts: true,
      milestoneAlerts: true,
    },
    clients,
    programmes,
    exercises,
    logs,
    measures,
    sessions,
    meals: [
      {
        id: "meal0",
        client: "c0",
        date: TODAY,
        name: "Greek yoghurt, oats & berries",
        type: "Breakfast",
        calories: 420,
        protein: 28,
        carbs: 54,
        fat: 10,
      },
      {
        id: "meal1",
        client: "c0",
        date: TODAY,
        name: "Chicken, rice & greens",
        type: "Lunch",
        calories: 620,
        protein: 48,
        carbs: 72,
        fat: 16,
      },
    ],
    water: { ["c0-" + TODAY]: 4 },
    activity: [
      {
        id: "a0",
        title: "Jess hit a new personal best",
        text: "110 kg deadlift. The consistency is paying off.",
        icon: "trophy",
        tone: "gold",
        date: TODAY,
      },
      {
        id: "a1",
        title: "Sam completed his session",
        text: "Strong foundations · Week 4 of 8",
        icon: "checkCircle",
        tone: "green",
        date: TODAY,
      },
      {
        id: "a2",
        title: "3 check-ins are ready to review",
        text: "A few words from you can make their week.",
        icon: "message",
        tone: "",
        date: TODAY,
      },
    ],
    readNotifications: [],
  };
}
