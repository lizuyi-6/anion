import { readFileSync } from "fs";
import { join } from "path";
import type { OpenClawSkillManifest } from "../types";
import type { OpenClawClient } from "../client";

function loadSkill(name: string): OpenClawSkillManifest {
  const skillDir = join(process.cwd(), "lib", "openclaw", "skills", name);
  const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error(`Invalid SKILL.md for ${name}: missing frontmatter`);
  }

  const metadata = Object.fromEntries(
    frontmatterMatch[1].split("\n").map((line) => {
      const [key, ...value] = line.split(":");
      return [key.trim(), value.join(":").trim()];
    }),
  );

  return {
    name: metadata.name ?? name,
    description: metadata.description ?? "",
    version: metadata.version,
    instructions: frontmatterMatch[2].trim(),
  };
}

export async function registerMobiusSkills(client: OpenClawClient): Promise<void> {
  const skills = ["mobius-copilot", "mobius-strategy", "mobius-sandbox"];

  for (const skillName of skills) {
    try {
      const manifest = loadSkill(skillName);
      await client.send("skill.list", { name: manifest.name });
      // Register if not already present
    } catch {
      console.warn(`Failed to register skill ${skillName}`);
    }
  }
}
