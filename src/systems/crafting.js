import { CONFIG } from "../data/index.js";
import { GlobalSystem } from "../state/globalSystem.js";
import { Inventory } from "./inventory.js";
import { recalcPlayerStats } from "../state/playerStats.js";
import { toast } from "../ui/toast.js";

export const Crafting = {
  visibleRecipes() {
    const discovered = GlobalSystem.data.discoveredItems || [];
    return CONFIG.recipes.filter((r) => {
      const matKeys = Object.keys(r.req).filter((k) => k !== "gold");
      if (matKeys.length === 0) return true;
      return matKeys.some((k) => discovered.includes(CONFIG.materials[k]?.name));
    });
  },

  canCraft(recipe) {
    return Object.keys(recipe.req).every((k) => Inventory.countMat(k) >= recipe.req[k]);
  },

  craft(name) {
    const recipe = CONFIG.recipes.find((r) => r.name === name);
    if (!recipe) return false;
    if (!this.canCraft(recipe)) {
      toast("素材不足", "warn");
      return false;
    }
    for (let k in recipe.req) Inventory.removeMat(k, recipe.req[k]);

    if (recipe.type === "consumable") {
      Inventory.add({
        id: Date.now() + Math.random(),
        name: recipe.name,
        baseName: recipe.name,
        type: "consumable",
        rarity: "legendary",
        effect: recipe.effect,
        desc: recipe.desc,
      });
      return true;
    }

    const item = {
      id: Date.now() + Math.random(),
      name: recipe.name,
      baseName: recipe.name,
      type: recipe.type,
      rarity: "epic",
      stats: { ...recipe.stats },
      setId: recipe.setId,
      desc: recipe.desc,
    };
    Inventory.add(item);
    recalcPlayerStats();
    return true;
  },
};
