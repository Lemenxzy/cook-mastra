import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { Recipe, MealPlan, SimpleRecipe, DayPlan } from "../types";
import {
  simplifyRecipe,
  processRecipeIngredients,
  categorizeIngredients,
} from "../utils/recipeUtils";
import { fetchRecipes } from "../data/recipes";



// 工厂函数，用于创建带有初始数据的工具
export function createRecommendMealsTool(initFoodData?: {
  recipes: Recipe[];
  categories: string[];
}) {
  // 内置的通用类别优先级（越靠前越常用）
  const DEFAULT_CATEGORY_ORDER = [
    "早餐",
    "主食",
    "荤菜",
    "素菜",
    "水产",
    "汤羹",
    "甜品",
    "小吃",
    "饮品",
    "其他",
  ];

  // 工具函数
  const norm = (s?: string) => (s || "").trim();
  const toLower = (s: string) => s.toLowerCase();
  const shuffle = <T>(arr: T[]) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // 从某分类池随机取一个并移出
  const pickAndPop = (
    pool: Record<string, Recipe[]>,
    category: string
  ): Recipe | null => {
    const list = pool[category];
    if (!list || list.length === 0) return null;
    const idx = Math.floor(Math.random() * list.length);
    const [picked] = list.splice(idx, 1);
    return picked || null;
  };

  // 在若干类别中，优先从仍有剩余的类别里抽；抽不到就尝试后备类别；再不行返回 null
  const pickFromCategories = (
    pool: Record<string, Recipe[]>,
    primary: string[],
    fallback: string[] = []
  ): Recipe | null => {
    const candidates = [...primary, ...fallback].filter(
      (c, i, arr) => arr.indexOf(c) === i
    ); // 去重
    const nonEmptyCats = candidates.filter((c) => (pool[c]?.length || 0) > 0);
    if (nonEmptyCats.length === 0) return null;
    const cat = nonEmptyCats[Math.floor(Math.random() * nonEmptyCats.length)];
    return pickAndPop(pool, cat);
  };

  // 批量拿菜：尽力而为，拿不到就少拿，绝不报错
  const getMeals = (
    pool: Record<string, Recipe[]>,
    count: number,
    primaryCats: string[],
    fallbackCats: string[]
  ): SimpleRecipe[] => {
    const result: SimpleRecipe[] = [];
    for (let i = 0; i < count; i++) {
      const recipe = pickFromCategories(
        pool,
        [primaryCats[i % primaryCats.length]],
        fallbackCats
      );
      if (!recipe) break;
      result.push(simplifyRecipe(recipe));
    }
    return result;
  };

  return createTool({
    id: "recommendMeals",
    description:
      "根据用户的忌口、过敏原、人数智能推荐菜谱，创建一周的膳食计划以及大致的购物清单",
    inputSchema: z.object({
      allergies: z
        .array(z.string())
        .optional()
        .describe('过敏原列表，如["大蒜","虾"]'),
      avoidItems: z
        .array(z.string())
        .optional()
        .describe('忌口食材列表，如["葱","姜"]'),
      peopleCount: z
        .number()
        .int()
        .min(1)
        .max(10)
        .describe("用餐人数，1-10之间的整数"),
    }),
    outputSchema: z.object({
      weekdays: z.any().optional(),
      weekend: z.any().optional(),
      groceryList: z.any().optional(),
      message: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        // 优先使用缓存的初始数据
        let allRecipes: Recipe[];
        if (initFoodData?.recipes && initFoodData.recipes.length > 0) {
          allRecipes = initFoodData.recipes;
          console.log(`使用缓存数据: ${allRecipes.length} 个菜谱`);
        } else {
          console.warn("缓存数据不可用，重新获取数据...");
          allRecipes = await fetchRecipes();
        }
        const categoryOrderBase = initFoodData?.categories?.length
          ? initFoodData.categories
          : DEFAULT_CATEGORY_ORDER;

        const {
          allergies = [],
          avoidItems = [],
          peopleCount,
        } = context as {
          allergies?: string[];
          avoidItems?: string[];
          peopleCount: number;
        };

        const aSet = (allergies || [])
          .map((s) => toLower(norm(s)))
          .filter(Boolean);
        const vSet = (avoidItems || [])
          .map((s) => toLower(norm(s)))
          .filter(Boolean);

        // 过滤：包含任一过敏/忌口即剔除
        const filteredRecipes = allRecipes.filter((recipe) => {
          const ings = (recipe.ingredients || []) as { name?: string }[];
          return !ings.some((ing) => {
            const name = toLower(norm(ing?.name || ""));
            return (
              aSet.some((x) => name.includes(x)) ||
              vSet.some((x) => name.includes(x))
            );
          });
        });

        if (filteredRecipes.length === 0) {
          return {
            weekdays: [],
            weekend: [],
            groceryList: {
              ingredients: [],
              shoppingPlan: { fresh: [], pantry: [], spices: [], others: [] },
            },
            message:
              "没有可用菜谱：所有菜谱都因过敏原或忌口被排除。请放宽条件或补充菜谱数据。",
          };
        }

        // 构建完整类别池：对所有出现过的类别建池；没有类别的归入“其他”
        const allCatsFromData = Array.from(
          new Set(
            filteredRecipes.map((r) => norm((r as any).category) || "其他")
          )
        ).filter(Boolean);

        // 最终类别顺序 = 外部顺序 + 数据中的新类别（去重）
        const finalCategoryOrder = [
          ...categoryOrderBase,
          ...allCatsFromData.filter((c) => !categoryOrderBase.includes(c)),
        ];

        const recipesByCategory: Record<string, Recipe[]> = {};
        finalCategoryOrder.forEach((c) => (recipesByCategory[c] = []));
        filteredRecipes.forEach((r) => {
          const c = norm((r as any).category) || "其他";
          if (!recipesByCategory[c]) recipesByCategory[c] = [];
          recipesByCategory[c].push(r);
        });

        // 计划骨架
        const mealPlan: MealPlan = {
          weekdays: [],
          weekend: [],
          groceryList: {
            ingredients: [],
            shoppingPlan: { fresh: [], pantry: [], spices: [], others: [] },
          },
        };

        const selectedRecipes: Recipe[] = [];

        // —— 工作日（周一 ~ 周五）
        const weekdayNames = ["周一", "周二", "周三", "周四", "周五"];
        for (let i = 0; i < 5; i++) {
          const dayPlan: DayPlan = {
            day: weekdayNames[i],
            breakfast: [],
            lunch: [],
            dinner: [],
          };

          // 早餐：优先“早餐”，后备为“主食/素菜/饮品/小吃”
          const breakfastCount = Math.max(1, Math.ceil(peopleCount / 5));
          for (let k = 0; k < breakfastCount; k++) {
            const rec = pickFromCategories(
              recipesByCategory,
              ["早餐"],
              ["主食", "素菜", "饮品", "小吃"]
            );
            if (!rec) break;
            selectedRecipes.push(rec);
            dayPlan.breakfast.push(simplifyRecipe(rec));
          }

          // 午/晚餐份数（尽量满足）
          const baseMealCount = Math.max(2, Math.ceil(peopleCount / 3));

          // 午餐：优先 主食/荤菜/素菜/水产/甜品
          for (let k = 0; k < baseMealCount; k++) {
            const rec = pickFromCategories(
              recipesByCategory,
              ["主食", "荤菜", "素菜", "水产", "甜品"],
              finalCategoryOrder // 兜底在所有类别中找
            );
            if (!rec) break;
            selectedRecipes.push(rec);
            dayPlan.lunch.push(simplifyRecipe(rec));
          }

          // 晚餐：在午餐基础上额外包含 汤羹
          for (let k = 0; k < baseMealCount; k++) {
            const rec = pickFromCategories(
              recipesByCategory,
              ["主食", "荤菜", "素菜", "水产", "汤羹", "甜品"],
              finalCategoryOrder
            );
            if (!rec) break;
            selectedRecipes.push(rec);
            dayPlan.dinner.push(simplifyRecipe(rec));
          }

          mealPlan.weekdays.push(dayPlan);
        }

        // —— 周末（周六、周日）
        const weekendNames = ["周六", "周日"];
        for (let i = 0; i < 2; i++) {
          const dayPlan: DayPlan = {
            day: weekendNames[i],
            breakfast: [],
            lunch: [],
            dinner: [],
          };

          // 周末早餐多一点
          const breakfastCount = Math.max(2, Math.ceil(peopleCount / 3));
          for (let k = 0; k < breakfastCount; k++) {
            const rec = pickFromCategories(
              recipesByCategory,
              ["早餐"],
              ["主食", "素菜", "饮品", "小吃"]
            );
            if (!rec) break;
            selectedRecipes.push(rec);
            dayPlan.breakfast.push(simplifyRecipe(rec));
          }

          // 周末午/晚餐比工作日多 1~2 个
          const weekdayMealCount = Math.max(2, Math.ceil(peopleCount / 3));
          const weekendAddition = peopleCount <= 4 ? 1 : 2;
          const mealCount = weekdayMealCount + weekendAddition;

          // 周末倾向“荤菜/水产”，不足再用“主食/素菜/汤羹”
          const lunchMeals = getMeals(
            recipesByCategory,
            mealCount,
            ["荤菜", "水产"],
            ["主食", "素菜", "汤羹", "甜品"]
          );
          lunchMeals.forEach((m) => dayPlan.lunch.push(m));

          const dinnerMeals = getMeals(
            recipesByCategory,
            mealCount,
            ["荤菜", "水产"],
            ["主食", "素菜", "汤羹", "甜品"]
          );
          dinnerMeals.forEach((m) => dayPlan.dinner.push(m));

          mealPlan.weekend.push(dayPlan);
        }

        // —— 统计食材清单
        const ingredientMap = new Map<
          string,
          {
            totalQuantity: number | null;
            unit: string | null;
            recipeCount: number;
            recipes: string[];
          }
        >();

        selectedRecipes.forEach((r) =>
          processRecipeIngredients(r, ingredientMap)
        );

        for (const [name, info] of ingredientMap.entries()) {
          mealPlan.groceryList.ingredients.push({
            name,
            totalQuantity: info.totalQuantity,
            unit: info.unit,
            recipeCount: info.recipeCount,
            recipes: info.recipes,
          });
        }

        mealPlan.groceryList.ingredients.sort(
          (a, b) => b.recipeCount - a.recipeCount
        );
        categorizeIngredients(
          mealPlan.groceryList.ingredients,
          mealPlan.groceryList.shoppingPlan
        );

        const totalPlanned =
          mealPlan.weekdays.reduce(
            (s, d) => s + d.breakfast.length + d.lunch.length + d.dinner.length,
            0
          ) +
          mealPlan.weekend.reduce(
            (s, d) => s + d.breakfast.length + d.lunch.length + d.dinner.length,
            0
          );
        console.log("总共选出菜谱:", totalPlanned);
        const totalAvailableAfterFilter = filteredRecipes.length;
        return {
          ...mealPlan,
          message: `成功为 ${peopleCount} 人生成一周膳食计划（共选出 ${totalPlanned} 道菜，备选池 ${totalAvailableAfterFilter} 条）。已排除过敏原：${
            aSet.join("、") || "无"
          }；忌口：${vSet.join("、") || "无"}。`,
        };
      } catch (error) {
        return {
          weekdays: [],
          weekend: [],
          groceryList: {
            ingredients: [],
            shoppingPlan: { fresh: [], pantry: [], spices: [], others: [] },
          },
          message: `生成膳食计划失败：${
            error instanceof Error ? error.message : "未知错误"
          }`,
        };
      }
    },
  });
}