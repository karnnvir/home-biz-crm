import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODEL = "claude-opus-5";

interface RequestBody {
  names: string[];
}

interface ExtractedGroup {
  canonicalName: string;
  members: string[];
}

const GROUP_TOOL_SCHEMA = {
  name: "group_items",
  description:
    "Group a list of item names (entered by voice or typed, for a home bakery's orders) into clusters that refer to the same real-world product — accounting for mishearings, typos, singular/plural, word reordering, and minor added/dropped descriptive words. Do not group genuinely different products together just because they sound similar.",
  input_schema: {
    type: "object" as const,
    properties: {
      groups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            canonicalName: {
              type: "string",
              description: "A clean, representative display name for this group (pick the clearest/most complete variant, or a sensible normalized version).",
            },
            members: {
              type: "array",
              items: { type: "string" },
              description: "The input names belonging to this group, copied EXACTLY as given.",
            },
          },
          required: ["canonicalName", "members"],
        },
      },
    },
    required: ["groups"],
  },
};

export const groupItemNames = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in first.");
    }

    const body = request.data as RequestBody;
    const names = (body?.names ?? []).filter((n) => n && n.trim());
    if (names.length === 0) {
      return { groups: [] };
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        tools: [GROUP_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "group_items" },
        messages: [
          {
            role: "user",
            content: `Group these item names — every name must end up in exactly one group:\n\n${JSON.stringify(names)}`,
          },
        ],
      });
    } catch (err) {
      console.error("Anthropic API error", err);
      throw new HttpsError("internal", "Couldn't group items right now. Try again.");
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new HttpsError("internal", "Couldn't group items right now. Try again.");
    }

    const extracted = (toolUse.input as { groups: ExtractedGroup[] }).groups ?? [];

    // Safety net: if the model dropped or duplicated any input name, make sure
    // every name still ends up in exactly one group rather than silently
    // losing revenue from the report.
    const seen = new Set<string>();
    const groups: ExtractedGroup[] = [];
    for (const g of extracted) {
      // Dedupe within this group's own list first — guards against the model
      // repeating a name twice in one group, not just across groups.
      const members = [...new Set(g.members)].filter((m) => names.includes(m) && !seen.has(m));
      members.forEach((m) => seen.add(m));
      if (members.length > 0) groups.push({ canonicalName: g.canonicalName, members });
    }
    for (const name of names) {
      if (!seen.has(name)) groups.push({ canonicalName: name, members: [name] });
    }

    return { groups };
  }
);
