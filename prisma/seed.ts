import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const members = [
  { displayName: "Mama", shortName: "Mama", role: "parent", color: "#ec4899", icon: "👩", sortOrder: 1 },
  { displayName: "Papa", shortName: "Papa", role: "parent", color: "#3b82f6", icon: "👨", sortOrder: 2 },
  { displayName: "Kind 1", shortName: "K1", role: "child", color: "#22c55e", icon: "🧒", sortOrder: 3 },
  { displayName: "Kind 2", shortName: "K2", role: "child", color: "#eab308", icon: "🧒", sortOrder: 4 },
  { displayName: "Kind 3", shortName: "K3", role: "child", color: "#8b5cf6", icon: "👧", sortOrder: 5 },
  { displayName: "Kind 4", shortName: "K4", role: "child", color: "#f97316", icon: "👶", sortOrder: 6 }
] as const;

async function main() {
  for (const member of members) {
    await prisma.familyMember.upsert({
      where: { id: member.shortName.toLowerCase().replace(" ", "-") },
      update: member,
      create: { id: member.shortName.toLowerCase().replace(" ", "-"), ...member }
    });
  }
}

main().finally(async () => prisma.$disconnect());
