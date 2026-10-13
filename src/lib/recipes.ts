import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import type { Recipe, RecipeIngredient } from "../types";

const recipesCol = collection(db, "recipes");

export function subscribeRecipes(cb: (recipes: Recipe[]) => void) {
  const q = query(recipesCol, orderBy("name"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Recipe, "id">) })));
  });
}

export async function createRecipe(
  name: string,
  ingredients: RecipeIngredient[],
  totalWeight: string | null,
  notes: string | null,
  photoBlob: Blob
): Promise<string> {
  const id = doc(recipesCol).id;
  const photoPath = `recipe-photos/${id}.jpg`;
  const storageRef = ref(storage, photoPath);
  await uploadBytes(storageRef, photoBlob, { contentType: "image/jpeg" });
  const photoUrl = await getDownloadURL(storageRef);

  const now = new Date().toISOString();
  await setDoc(doc(db, "recipes", id), {
    name,
    ingredients,
    totalWeight,
    notes,
    photoPath,
    photoUrl,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateRecipe(
  id: string,
  changes: Partial<Pick<Recipe, "name" | "ingredients" | "totalWeight" | "notes">>
): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    ...changes,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteRecipe(recipe: Recipe): Promise<void> {
  await deleteDoc(doc(db, "recipes", recipe.id));
  try {
    await deleteObject(ref(storage, recipe.photoPath));
  } catch {
    // Best-effort — an orphaned Storage file isn't worth failing the delete over.
  }
}
