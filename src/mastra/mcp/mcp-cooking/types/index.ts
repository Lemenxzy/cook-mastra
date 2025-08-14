// 食材接口
export interface Ingredient {
  name: string;
  quantity?: number | null;
  text_quantity?: string;
  unit?: string | null;
}

// 完整菜谱接口
export interface Recipe {
  id: string;
  name: string;
  description: string;
  category?: string;
  ingredients: Ingredient[];
  steps?: string[];
  cookingTime?: string;
  difficulty?: string;
  tags?: string[];
}

// 简化菜谱接口（包含食材）
export interface SimpleRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: {
    name: string;
    text_quantity?: string;
  }[];
}

// 仅名称和描述的菜谱接口
export interface NameOnlyRecipe {
  name: string;
  description: string;
}

// 每周菜单接口
export interface WeeklyMenu {
  day: string;
  breakfast?: {
    name: string;
    ingredients?: string[];
  };
  lunch?: {
    name: string;
    ingredients?: string[];
  };
  dinner?: {
    name: string;
    ingredients?: string[];
  };
}

// 购物清单接口
export interface ShoppingPlan {
  fresh: string[];
  pantry: string[];
  spices: string[];
  others: string[];
}

// 菜品推荐接口
export interface DishRecommendation {
  peopleCount: number;
  meatDishCount: number;
  vegetableDishCount: number;
  dishes: SimpleRecipe[];
  message: string;
}

// 日计划接口
export interface DayPlan {
  day: string;
  breakfast: SimpleRecipe[];
  lunch: SimpleRecipe[];
  dinner: SimpleRecipe[];
}

// 膳食计划接口
export interface MealPlan {
  weekdays: DayPlan[];
  weekend: DayPlan[];
  groceryList: {
    ingredients: {
      name: string;
      totalQuantity: number | null;
      unit: string | null;
      recipeCount: number;
      recipes: string[];
    }[];
    shoppingPlan: ShoppingPlan;
  };
}