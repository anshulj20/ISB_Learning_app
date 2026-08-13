import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const db = new PrismaClient({ adapter });

(async () => {
  const files = await db.sourceFile.findMany({
    where: { storedPath: { contains: "statistics-section-a-b-isb" } },
    orderBy: { storedPath: "asc" },
    select: { originalFileName: true, storedPath: true },
  });
  for (const f of files) console.log(f.storedPath);
  await db.$disconnect();
})();
