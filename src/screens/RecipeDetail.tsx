import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteRecipe, subscribeRecipes, updateRecipe } from "../lib/recipes";
import { parseWeightGrams, scaleRecipe } from "../lib/recipeScale";
import { RecipeIngredientFields } from "../components/RecipeIngredientFields";
import type { Recipe, RecipeIngredient } from "../types";

const SAVE_DEBOUNCE_MS = 700;
type ViewMode = "original" | "1.5x" | "2x";

export function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([]);
  const [draftTotalWeight, setDraftTotalWeight] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("original");

  const initialized = useRef(false);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      subscribeRecipes((r) => {
        setRecipes(r);
        setLoaded(true);
      }),
    []
  );

  useEffect(() => {
    return () => {
      if (savedBannerTimer.current) clearTimeout(savedBannerTimer.current);
    };
  }, []);

  const recipe = recipes.find((r) => r.id === id);

  useEffect(() => {
    if (!initialized.current && recipe) {
      setDraftName(recipe.name);
      setDraftIngredients(recipe.ingredients);
      setDraftTotalWeight(recipe.totalWeight);
      setDraftNotes(recipe.notes);
      initialized.current = true;
    }
  }, [recipe]);

  useEffect(() => {
    if (!initialized.current || !id) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateRecipe(id, {
          name: draftName.trim() || "Untitled recipe",
          ingredients: draftIngredients.filter((i) => i.name.trim()),
          totalWeight: draftTotalWeight,
          notes: draftNotes,
        });
        setJustSaved(true);
        if (savedBannerTimer.current) clearTimeout(savedBannerTimer.current);
        savedBannerTimer.current = setTimeout(() => setJustSaved(false), 2000);
      } finally {
        setSaving(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftName, draftIngredients, draftTotalWeight, draftNotes]);

  const handleDelete = async () => {
    if (!recipe) return;
    if (!confirm("Delete this recipe? This can't be undone.")) return;
    await deleteRecipe(recipe);
    navigate("/recipes");
  };

  if (!recipe) {
    return (
      <div className="screen">
        <div className="empty-state">{loaded ? "Recipe not found." : "Loading…"}</div>
      </div>
    );
  }

  const currentWeight = parseWeightGrams(recipe.totalWeight);
  const target150 = currentWeight ? Math.round(currentWeight * 1.5) : null;
  const target200 = currentWeight ? currentWeight * 2 : null;
  const scaled = viewMode === "1.5x" && target150 ? scaleRecipe(recipe, target150) : viewMode === "2x" && target200 ? scaleRecipe(recipe, target200) : null;

  return (
    <div className="screen">
      <div className="app-header" style={{ padding: "8px 0 4px" }}>
        <Link to="/recipes" className="back-link">
          ‹ Recipes
        </Link>
        <h1>{recipe.name}</h1>
        <p style={justSaved ? { color: "var(--color-success)", fontWeight: 600 } : undefined}>
          {saving ? "Saving…" : justSaved ? "✓ Saved" : "Changes save automatically"}
        </p>
      </div>

      <img
        src={recipe.photoUrl}
        alt={recipe.name}
        style={{ width: "100%", borderRadius: 12, marginBottom: 14 }}
      />

      <div className="tabs">
        <button className={viewMode === "original" ? "active" : ""} onClick={() => setViewMode("original")}>
          Original{currentWeight ? ` (${currentWeight} g)` : ""}
        </button>
        <button
          className={viewMode === "1.5x" ? "active" : ""}
          onClick={() => setViewMode("1.5x")}
          disabled={!target150}
        >
          1.5×{target150 ? ` (${target150} g)` : ""}
        </button>
        <button
          className={viewMode === "2x" ? "active" : ""}
          onClick={() => setViewMode("2x")}
          disabled={!target200}
        >
          2×{target200 ? ` (${target200} g)` : ""}
        </button>
      </div>

      {viewMode === "original" ? (
        <div className="card">
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
        </div>
      ) : !currentWeight ? (
        <div className="card">
          <div className="empty-state">Set a total weight in Original first — scaling needs a starting point.</div>
        </div>
      ) : (
        scaled && (
          <div className="card">
            <div style={{ color: "var(--color-text-muted)", marginBottom: 10, fontSize: 13 }}>
              Scaled from {recipe.totalWeight} — read-only. Switch to Original to edit.
            </div>
            {scaled.ingredients.map((ing, i) => (
              <div key={i} className="item-row">
                <div className="item-qty" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ing.quantity ?? "—"}
                </div>
                <div className="item-unit" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ing.unit ?? ""}
                </div>
                <div className="item-name" style={{ display: "flex", alignItems: "center" }}>{ing.name}</div>
              </div>
            ))}
            {recipe.notes && (
              <div style={{ marginTop: 14, fontSize: 14 }}>
                <strong>Notes: </strong>
                {recipe.notes}
              </div>
            )}
          </div>
        )
      )}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button
          onClick={handleDelete}
          style={{ background: "none", border: "none", color: "var(--color-danger)", fontSize: 14, padding: 10 }}
        >
          Delete recipe
        </button>
      </div>
    </div>
  );
}
