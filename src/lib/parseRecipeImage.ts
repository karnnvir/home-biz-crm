import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { RecipeIngredient } from "../types";

interface ParseRecipeImageRequest {
  imageBase64: string;
  mediaType: string;
}

interface ParseRecipeImageResponse {
  name: string;
  ingredients: RecipeIngredient[];
  totalWeight: string | null;
  notes: string | null;
}

const parseRecipeImageFn = httpsCallable<ParseRecipeImageRequest, ParseRecipeImageResponse>(
  functions,
  "parseRecipeImage"
);

export async function parseRecipeImage(
  imageBase64: string,
  mediaType: string
): Promise<ParseRecipeImageResponse> {
  const result = await parseRecipeImageFn({ imageBase64, mediaType });
  return result.data;
}
