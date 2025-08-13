import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { Recipe, DishRecommendation, SimpleRecipe } from "../types";
import { simplifyRecipe } from "../utils/recipeUtils";
import { fetchRecipes } from "../data/recipes";

// 工厂函数，用于创建带有初始数据的工具
export function createWhatToEatTool(initFoodData?: { recipes: Recipe[], categories: string[] }) {
  return createTool({
    id: "whatToEat",
    description: "不知道吃什么？根据人数直接推荐适合的菜品组合",
    inputSchema: z.object({
      peopleCount: z
        .number()
        .int()
        .min(1)
        .max(10)
        .describe("用餐人数，1-10之间的整数，会根据人数推荐合适数量的菜品"),
    }),
    outputSchema: z.object({
      peopleCount: z.number().optional(),
      meatDishCount: z.number().optional(),
      vegetableDishCount: z.number().optional(),
      dishes: z.any().optional(),
      message: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        // 优先使用缓存的初始数据
        let recipes: Recipe[];
        if (initFoodData?.recipes && initFoodData.recipes.length > 0) {
          recipes = initFoodData.recipes;
          console.log(`使用缓存数据: ${recipes.length} 个菜谱`);
        } else {
          console.warn("缓存数据不可用，重新获取数据...");
          recipes = await fetchRecipes();
        }
        const { peopleCount } = context;
        console.log("当前用餐人数:", peopleCount);
        // 根据人数计算荤素菜数量
        const vegetableCount = Math.floor((peopleCount + 1) / 2);
        const meatCount = Math.ceil((peopleCount + 1) / 2);

        // 获取所有荤菜
        let meatDishes = recipes.filter(
          (recipe) => recipe.category === "荤菜" || recipe.category === "水产"
        );

        // 获取其他可能的菜品（当做素菜）
        let vegetableDishes = recipes.filter(
          (recipe) =>
            recipe.category !== "荤菜" &&
            recipe.category !== "水产" &&
            recipe.category !== "早餐" &&
            recipe.category !== "主食"
        );

        // 特别处理：如果人数超过8人，增加鱼类荤菜
        let recommendedDishes: Recipe[] = [];
        let fishDish: Recipe | null = null;

        if (peopleCount > 8) {
          const fishDishes = recipes.filter(
            (recipe) => recipe.category === "水产"
          );
          if (fishDishes.length > 0) {
            fishDish =
              fishDishes[Math.floor(Math.random() * fishDishes.length)];
            if (fishDish) {
              recommendedDishes.push(fishDish);
            }
          }
        }

        // 打乱肉类优先级顺序，增加随机性
        const meatTypes = ["猪肉", "鸡肉", "牛肉", "羊肉", "鸭肉", "鱼肉"];
        // 使用 Fisher-Yates 洗牌算法打乱数组
        for (let i = meatTypes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [meatTypes[i], meatTypes[j]] = [meatTypes[j], meatTypes[i]];
        }

        const selectedMeatDishes: Recipe[] = [];

        // 需要选择的荤菜数量
        const remainingMeatCount = fishDish ? meatCount - 1 : meatCount;

        // 尝试按照随机化的肉类优先级选择荤菜
        for (const meatType of meatTypes) {
          if (selectedMeatDishes.length >= remainingMeatCount) break;

          const meatTypeOptions = meatDishes.filter((dish) => {
            // 检查菜品的材料是否包含这种肉类
            return dish.ingredients?.some((ingredient: { name: string }) => {
              const name = ingredient.name?.toLowerCase() || "";
              return name.includes(meatType.toLowerCase());
            });
          });

          if (meatTypeOptions.length > 0) {
            // 随机选择一道这种肉类的菜
            const selected =
              meatTypeOptions[
                Math.floor(Math.random() * meatTypeOptions.length)
              ];
            selectedMeatDishes.push(selected);
            // 从可选列表中移除，避免重复选择
            meatDishes = meatDishes.filter((dish) => dish.id !== selected.id);
          }
        }

        // 如果通过肉类筛选的荤菜不够，随机选择剩余的
        while (
          selectedMeatDishes.length < remainingMeatCount &&
          meatDishes.length > 0
        ) {
          const randomIndex = Math.floor(Math.random() * meatDishes.length);
          selectedMeatDishes.push(meatDishes[randomIndex]);
          meatDishes.splice(randomIndex, 1);
        }

        // 随机选择素菜
        const selectedVegetableDishes: Recipe[] = [];
        while (
          selectedVegetableDishes.length < vegetableCount &&
          vegetableDishes.length > 0
        ) {
          const randomIndex = Math.floor(
            Math.random() * vegetableDishes.length
          );
          selectedVegetableDishes.push(vegetableDishes[randomIndex]);
          vegetableDishes.splice(randomIndex, 1);
        }

        // 合并推荐菜单
        recommendedDishes = recommendedDishes.concat(
          selectedMeatDishes,
          selectedVegetableDishes
        );

        // 返回推荐结果
        return {
          peopleCount,
          meatDishCount: selectedMeatDishes.length + (fishDish ? 1 : 0),
          vegetableDishCount: selectedVegetableDishes.length,
          dishes: recommendedDishes.map(simplifyRecipe),
          message: `为${peopleCount}人推荐的菜品，包含${
            selectedMeatDishes.length + (fishDish ? 1 : 0)
          }个荤菜和${selectedVegetableDishes.length}个素菜。`,
        };
      } catch (error) {
        return {
          peopleCount: context.peopleCount,
          meatDishCount: 0,
          vegetableDishCount: 0,
          dishes: [],
          message: `推荐菜品失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`,
        };
      }
    },
  });
}

