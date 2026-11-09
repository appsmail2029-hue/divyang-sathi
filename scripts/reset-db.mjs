#!/usr/bin/env node
/* Reset the local SQLite database. The next server start recreates and seeds it. */

import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve("data");
const dbFiles = ["metro.db", "metro.db-wal", "metro.db-shm"].map((name) => path.join(dataDir, name));

async function serverIsRunning() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const response = await fetch("http://localhost:3000/login", { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

if (await serverIsRunning()) {
  console.error("A Metro Assist server is running on port 3000. Stop it before resetting the database.");
  process.exit(1);
}

let removed = 0;
for (const file of dbFiles) {
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    removed += 1;
    console.log(`Removed ${path.relative(process.cwd(), file)}`);
  }
}

if (!removed) console.log("No database files found; nothing to reset.");
console.log("Start the app with `npm run dev` to create a fresh database and demonstration data.");
