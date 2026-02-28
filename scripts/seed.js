import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "../src/db/mongoose.js";
import { TypingTest, User } from "../src/models/index.js";

async function upsertUser({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.passwordHash = passwordHash;
    await existing.save();
    return existing;
  }

  return User.create({ name, email, passwordHash, role });
}

async function seedUsers() {
  const users = [
    { name: "Admin", email: "admin@example.com", password: "Admin@12345", role: "ADMIN" },
    { name: "Nova", email: "nova@example.com", password: "Password@123", role: "PLAYER" },
    { name: "Kai", email: "kai@example.com", password: "Password@123", role: "PLAYER" },
    { name: "Zara", email: "zara@example.com", password: "Password@123", role: "PLAYER" },
    { name: "Ivy", email: "ivy@example.com", password: "Password@123", role: "PLAYER" }
  ];

  const createdUsers = [];
  for (const user of users) {
    createdUsers.push(await upsertUser(user));
  }

  return createdUsers.find((user) => user.role === "ADMIN");
}

async function seedTypingTests(adminUser) {
  const predefinedTests = [
    {
      title: "Easy Warmup 1",
      difficulty: "EASY",
      timeLimit: 60,
      text: "Practice each line with a steady rhythm and focus on clean, mistake free keystrokes."
    },
    {
      title: "Easy Warmup 2",
      difficulty: "EASY",
      timeLimit: 60,
      text: "Fast typing grows from daily habits, correct posture, and repeated short sessions."
    },
    {
      title: "Medium Sprint 1",
      difficulty: "MEDIUM",
      timeLimit: 45,
      text: "Consistent speed and accuracy under time pressure separate strong players from casual typists."
    },
    {
      title: "Medium Sprint 2",
      difficulty: "MEDIUM",
      timeLimit: 45,
      text: "A reliable cadence helps you recover from errors quickly and maintain competitive performance."
    },
    {
      title: "Hard Arena 1",
      difficulty: "HARD",
      timeLimit: 30,
      text: "Elite competitors sustain accuracy through complex punctuation, dense phrasing, and relentless pace."
    },
    {
      title: "Hard Arena 2",
      difficulty: "HARD",
      timeLimit: 30,
      text: "High level tournaments reward composure, precision, and rapid adaptation to difficult text segments."
    }
  ];

  for (const test of predefinedTests) {
    const exists = await TypingTest.findOne({ title: test.title });
    if (!exists) {
      await TypingTest.create({
        ...test,
        createdById: adminUser._id,
        isActive: true
      });
    }
  }
}

async function main() {
  await connectDB();
  const adminUser = await seedUsers();
  await seedTypingTests(adminUser);
  console.log("MongoDB seed completed.");
}

main()
  .then(async () => {
    await disconnectDB();
  })
  .catch(async (error) => {
    console.error(error);
    await disconnectDB();
    process.exit(1);
  });
