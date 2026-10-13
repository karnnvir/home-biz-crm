import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export interface ItemNameGroup {
  canonicalName: string;
  members: string[];
}

interface GroupItemNamesRequest {
  names: string[];
}

interface GroupItemNamesResponse {
  groups: ItemNameGroup[];
}

const groupItemNamesFn = httpsCallable<GroupItemNamesRequest, GroupItemNamesResponse>(
  functions,
  "groupItemNames"
);

export async function groupItemNames(names: string[]): Promise<ItemNameGroup[]> {
  const result = await groupItemNamesFn({ names });
  return result.data.groups;
}
