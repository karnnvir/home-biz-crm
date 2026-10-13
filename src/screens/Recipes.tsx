import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { compressImage } from "../lib/imageCompress";
import { parseRecipeImage } from "../lib/parseRecipeImage";
import { createRecipe, subscribeRecipes } from "../lib/recipes";
import { RecipeIngredientFields } from "../components/RecipeIngredientFields";
import type { Recipe, RecipeIngredient } from "../types";

type Stage = "idle" | "processing" | "confirming" | "saving";

export function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([]);
  const [draftTotalWeight, setDraftTotalWeight] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeRecipes(setRecipes), []);

  const reset = () => {
    setStage("idle");
    setError(null);
    setPhotoPreview(null);
    setPhotoBlob(null);
    setDraftName("");
    setDraftIngredients([]);
    setDraftTotalWeight(null);
    setDraftNotes(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStage("processing");
    try {
      const { blob, base64 } = await compressImage(file);
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
      const parsed = await parseRecipeImage(base64, "image/jpeg");
      setDraftName(parsed.name);
      setDraftIngredients(
        parsed.ingredients.length ? parsed.ingredients : [{ name: "", quantity: null, unit: null }]
      );
      setDraftTotalWeight(parsed.totalWeight);
      setDraftNotes(parsed.notes);
      setStage("confirming");
    } catch (err) {
      console.error(err);
      setError("Couldn't read that recipe. Try a clearer photo, or better lighting.");
      setStage("idle");
    }
  };

  const handleConfirm = async () => {
    if (!photoBlob) return;
    setStage("saving");
    try {
      await createRecipe(
        draftName.trim() || "Untitled recipe",
        draftIngredients.filter((i) => i.name.trim()),
        draftTotalWeight,
        draftNotes,
        photoBlob
      );
      reset();
    } catch (err) {
      console.error(err);
      setError("Couldn't save that recipe — check your connection and try again.");
      setStage("confirming");
    }
  };

  return (
    <div className="screen">
      <div className="app-header" style={{ padding: "8px 0 4px" }}>
        <h1>Recipes</h1>
        <p>
          {recipes.length} saved
        </p>
      </div>

      {stage === "idle" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          <button className="big-button primary" onClick={() => fileInputRef.current?.click()}>
            📷 Add recipe
          </button>
          {error && <div className="error-text">{error}</div>}
        </>
      )}

      {stage === "processing" && (
        <div className="card">
          {photoPreview && (
            <img src={photoPreview} alt="Captured recipe" style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
          )}
          <div className="empty-state">Reading recipe…</div>
        </div>
      )}

      {(stage === "confirming" || stage === "saving") && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Add this recipe?</div>
          {photoPreview && (
            <img src={photoPreview} alt="Captured recipe" style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
          )}
          <RecipeIngredientFields
            name={draftName}
            onNameChange={setDraftName}
            ingredients={draftIngredients}
            onIngredientsChange={setDraftIngredients}
            totalWeight={draftTotalWeight}
            onTotalWeightChange={setDraftTotalWeight}
            notes={draftNotes}
            onNotesChange={setDraftNotes}
          />
          {error && <div className="error-text">{error}</div>}
          <div className="button-row">
            <button className="big-button secondary" onClick={reset} disabled={stage === "saving"}>
              Cancel
            </button>
            <button className="big-button primary" onClick={handleConfirm} disabled={stage === "saving"}>
              {stage === "saving" ? "Saving…" : "Save recipe"}
            </button>
          </div>
        </div>
      )}

      {stage === "idle" && (
        <div className="card">
          {recipes.length === 0 ? (
            <div className="empty-state">No recipes yet. Tap "Add recipe" to photograph one.</div>
          ) : (
            recipes.map((recipe) => (
              <Link className="order-row" to={`/recipes/${recipe.id}`} key={recipe.id} style={{ gap: 12 }}>
                <span className="recipe-icon">📖</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="items">{recipe.name}</div>
                  <div className="meta">
                    {recipe.ingredients.length} ingredients
                    {recipe.totalWeight ? ` · ${recipe.totalWeight} base batch` : ""}
                  </div>
                </div>
                <span className="row-chevron">›</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
