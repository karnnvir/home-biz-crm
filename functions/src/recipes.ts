import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODEL = "claude-opus-5";

interface RequestBody {
  imageBase64: string;
  mediaType: string;
}

interface ExtractedIngredient {
  name: string;
  quantity: string | null;
  unit: string | null;
}

interface ExtractedRecipe {
  name: string;
  ingredients: ExtractedIngredient[];
  totalWeight: string | null;
  notes: string | null;
}

const RECIPE_TOOL_SCHEMA = {
  name: "extract_recipe",
  description: "Extract a recipe name, ingredient list, total weight, and any other notes from a photo of a handwritten recipe page.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "The recipe's title, if visible in the photo; otherwise a short, reasonable name based on the ingredients (e.g. 'Chocolate Cake').",
      },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Ingredient name, expanded to its full form rather than an abbreviation — e.g. 'BP' -> 'Baking powder', 'B soda' -> 'Baking soda', 'coco' -> 'Cocoa powder'.",
            },
            quantity: {
              type: ["string", "null"],
              description: "Quantity exactly as written, preserving fractions rather than converting to decimals — e.g. '1/4', '1/2', '3/4', '35', '2'. Null if no amount is written for this ingredient (e.g. 'walnuts' with nothing next to it) — meaning 'to taste', not zero. Never invent a number that isn't written.",
            },
            unit: {
              type: ["string", "null"],
              description: "Unit of measure, normalized to a short form: 'g' for grams, 'tbsp' for tablespoon, 'tsp' for teaspoon. Null if the quantity has no unit (e.g. '2 eggs', '1 banana') or if quantity itself is null.",
            },
          },
          required: ["name"],
        },
      },
      totalWeight: {
        type: ["string", "null"],
        description: "The recipe's total weight, ONLY if explicitly written on the page (e.g. a number in grams near the title or margin, like '500gms'). This is an important, distinct figure — do not confuse it with an ingredient quantity, and do not guess one if it isn't clearly written. Normalize to e.g. '500 g'. Null if not present.",
      },
      notes: {
        type: ["string", "null"],
        description: "Any other handwritten info that isn't an ingredient or the total weight — pan size, yield/servings, oven temperature, baking time, etc. Null if there's nothing like that.",
      },
    },
    required: ["name", "ingredients"],
  },
};

export const parseRecipeImage = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in first.");
    }

    const body = request.data as RequestBody;
    if (!body?.imageBase64) {
      throw new HttpsError("invalid-argument", "Missing image.");
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        tools: [RECIPE_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "extract_recipe" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: (body.mediaType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: body.imageBase64,
                },
              },
              {
                type: "text",
                text: "Extract the recipe name, ingredient list (with quantity and unit), total weight (if explicitly written), and any other notes from this photo of a handwritten recipe page.",
              },
            ],
          },
        ],
      });
    } catch (err) {
      console.error("Anthropic API error", err);
      throw new HttpsError("internal", "Couldn't read that recipe right now. Try again.");
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new HttpsError("internal", "Couldn't read that recipe. Try a clearer photo.");
    }

    const extracted = toolUse.input as ExtractedRecipe;
    return {
      name: extracted.name,
      ingredients: extracted.ingredients ?? [],
      totalWeight: extracted.totalWeight ?? null,
      notes: extracted.notes ?? null,
    };
  }
);
