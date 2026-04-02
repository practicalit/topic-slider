import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "admin123",
    10
  );
  const volunteerPassword = await bcrypt.hash(
    process.env.VOLUNTEER_PASSWORD || "volunteer123",
    10
  );

  // Upsert admin user
  await prisma.user.upsert({
    where: { username: process.env.ADMIN_USERNAME || "admin" },
    update: {},
    create: {
      username: process.env.ADMIN_USERNAME || "admin",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Upsert volunteer user
  await prisma.user.upsert({
    where: { username: process.env.VOLUNTEER_USERNAME || "volunteer" },
    update: {},
    create: {
      username: process.env.VOLUNTEER_USERNAME || "volunteer",
      password: volunteerPassword,
      role: "VOLUNTEER",
    },
  });

  console.log("Seeded admin and volunteer users");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
