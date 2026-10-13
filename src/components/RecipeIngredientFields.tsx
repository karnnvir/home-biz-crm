import type { RecipeIngredient } from "../types";

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  ingredients: RecipeIngredient[];
  onIngredientsChange: (ingredients: RecipeIngredient[]) => void;
  totalWeight: string | null;
  onTotalWeightChange: (totalWeight: string | null) => void;
  notes: string | null;
  onNotesChange: (notes: string | null) => void;
}

export function RecipeIngredientFields({
  name,
  onNameChange,
  ingredients,
  onIngredientsChange,
  totalWeight,
  onTotalWeightChange,
  notes,
  onNotesChange,
}: Props) {
  const updateIngredient = (index: number, patch: Partial<RecipeIngredient>) => {
    onIngredientsChange(ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
  };

  const removeIngredient = (index: number) => {
    onIngredientsChange(ingredients.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    onIngredientsChange([...ingredients, { name: "", quantity: null, unit: null }]);
  };

  return (
    <>
      <div className="field">
        <label>Recipe name</label>
        <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Chocolate Cake" />
      </div>

      <div className="field">
        <label>Total weight</label>
        <input
          value={totalWeight ?? ""}
          onChange={(e) => onTotalWeightChange(e.target.value || null)}
          placeholder="e.g. 500 g — leave blank if not known"
        />
      </div>

      <div className="field">
        <label>Ingredients (blank quantity = to taste)</label>
        {ingredients.map((ing, i) => (
          <div key={i} className="item-row">
            <input
              className="item-qty"
              type="text"
              inputMode="text"
              placeholder="qty"
              value={ing.quantity ?? ""}
              onChange={(e) => updateIngredient(i, { quantity: e.target.value || null })}
            />
            <input
              className="item-unit"
              value={ing.unit ?? ""}
              onChange={(e) => updateIngredient(i, { unit: e.target.value || null })}
              placeholder="unit"
            />
            <input
              className="item-name"
              value={ing.name}
              onChange={(e) => updateIngredient(i, { name: e.target.value })}
              placeholder="e.g. All-purpose flour"
            />
            <button
              type="button"
              className="icon-button danger"
              onClick={() => removeIngredient(i)}
              aria-label="Remove ingredient"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="big-button secondary" onClick={addIngredient}>
          + Add ingredient
        </button>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea
          value={notes ?? ""}
          onChange={(e) => onNotesChange(e.target.value || null)}
          placeholder="Pan size, yield, oven temp, baking time…"
          rows={3}
        />
      </div>
    </>
  );
}
