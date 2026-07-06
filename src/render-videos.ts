import path from "node:path";
import fs from "node:fs/promises";
import {spawn} from "node:child_process";

async function main() {
  const dataDir = path.join(process.cwd(), "output", "remotion-data");
  const files = (await fs.readdir(dataDir)).filter((file) => file.endsWith(".json"));

  if (!files.length) {
    console.log("No Remotion data files found. Run the pipeline first.");
    return;
  }

  for (const file of files) {
    const inputPath = path.join(dataDir, file);
    const input = JSON.parse(await fs.readFile(inputPath, "utf8")) as {videoFile: string; props: Record<string, unknown>};
    const child = spawn("npx", [
      "remotion",
      "render",
      "src/remotion/index.ts",
      "lead-preview",
      input.videoFile,
      "--props",
      JSON.stringify(input.props),
    ], {stdio: "inherit"});
    await new Promise((resolve, reject) => {
      child.on("exit", (code: number | null) => (code === 0 ? resolve(undefined) : reject(new Error(`Remotion exited with ${code}`))));
      child.on("error", reject);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
