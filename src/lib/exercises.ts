// The exercise library members pick from. Anything not here can still be typed in as a custom exercise.
export const EXERCISES: Record<string, string[]> = {
  Chest: [
    "Bench press", "Incline bench press", "Decline bench press", "Close-grip bench press", "Dumbbell bench press", "Incline dumbbell press",
    "Decline dumbbell press", "Dumbbell fly", "Incline dumbbell fly", "Cable fly", "Low-to-high cable fly", "Pec deck",
    "Machine chest press", "Smith machine bench press", "Push-up", "Weighted push-up", "Chest dips", "Dumbbell pullover",
  ],
  Back: [
    "Deadlift", "Rack pull", "Pull-up", "Chin-up", "Assisted pull-up", "Lat pulldown", "Close-grip lat pulldown", "Straight-arm pulldown",
    "Barbell row", "Pendlay row", "Dumbbell row", "Chest-supported row", "T-bar row", "Seated cable row", "Machine row", "Inverted row",
    "Meadows row", "Back extension", "Good morning",
  ],
  Shoulders: [
    "Overhead press", "Seated dumbbell press", "Arnold press", "Machine shoulder press", "Push press", "Landmine press", "Lateral raise",
    "Cable lateral raise", "Machine lateral raise", "Front raise", "Rear delt fly", "Reverse pec deck", "Face pull", "Upright row",
    "Barbell shrug", "Dumbbell shrug",
  ],
  Biceps: [
    "Barbell curl", "EZ-bar curl", "Dumbbell curl", "Hammer curl", "Incline dumbbell curl", "Preacher curl", "Concentration curl",
    "Cable curl", "Bayesian cable curl", "Spider curl", "Reverse curl",
  ],
  Triceps: [
    "Triceps pushdown", "Rope pushdown", "Overhead cable extension", "Overhead dumbbell extension", "Skull crusher", "Dips",
    "Bench dips", "Triceps kickback", "JM press", "Diamond push-up",
  ],
  Legs: [
    "Squat", "Front squat", "Goblet squat", "Hack squat", "Smith machine squat", "Leg press", "Bulgarian split squat", "Walking lunge",
    "Reverse lunge", "Step-up", "Leg extension", "Sissy squat", "Romanian deadlift", "Stiff-leg deadlift", "Lying leg curl",
    "Seated leg curl", "Nordic curl", "Standing calf raise", "Seated calf raise", "Leg press calf raise",
  ],
  Glutes: [
    "Hip thrust", "Barbell glute bridge", "Cable kickback", "Hip abduction machine", "Hip adduction machine", "Sumo deadlift",
    "Cable pull-through", "Frog pump",
  ],
  Core: [
    "Plank (seconds)", "Side plank (seconds)", "Crunch", "Cable crunch", "Hanging leg raise", "Hanging knee raise", "Lying leg raise",
    "Ab wheel rollout", "Russian twist", "Bicycle crunch", "Dead bug", "Pallof press", "Mountain climber", "Decline sit-up",
  ],
  "Full body": [
    "Power clean", "Clean and press", "Kettlebell swing", "Thruster", "Burpee", "Farmer's carry", "Sled push", "Battle ropes (seconds)",
    "Box jump", "Wall ball",
  ],
  Cardio: [
    "Treadmill (minutes)", "Incline walk (minutes)", "Cycling (minutes)", "Elliptical (minutes)", "Rowing machine (minutes)",
    "Stair climber (minutes)", "Skipping (minutes)", "Running (km)",
  ],
};
