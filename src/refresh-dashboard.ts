import fs from "node:fs/promises";

import {outputFiles} from "@/config";
import {EliteOpsDatabase} from "@/database";
import {createDashboardHtml} from "@/dashboard";
import type {DashboardData} from "@/types";

async function main() {
  const database = new EliteOpsDatabase();
  try {
    const raw = await fs.readFile(outputFiles.crmJson, "utf8");
    database.syncPipelineData(JSON.parse(raw) as DashboardData);
  } catch {
    // Keep any existing persisted state if the pipeline snapshot does not exist yet.
  }
  await fs.writeFile(outputFiles.dashboardHtml, createDashboardHtml(database.getState(), outputFiles.dashboardHtml), "utf8");
  console.log(`Dashboard refreshed at ${outputFiles.dashboardHtml}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
