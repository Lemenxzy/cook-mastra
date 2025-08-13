// FatSecret API响应类型定义

// 食物自动补全响应
export interface FoodSuggestion {
  food_name: string;
  food_id?: string;
}

export interface AutocompleteResponse {
  suggestions: {
    suggestion: FoodSuggestion[];
  };
}

// 营养信息
export interface NutritionInfo {
  calories: number;
  carbohydrate: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturated_fat: number;
  polyunsaturated_fat: number;
  monounsaturated_fat: number;
}

// 食谱信息
export interface RecipeInfo {
  recipe_id: string;
  recipe_name: string;
  recipe_description: string;
  recipe_url: string;
  servings: number;
  preparation_time: number;
  cooking_time: number;
  nutrition_info: NutritionInfo;
  ingredients: string[];
  directions: string[];
}

// OAuth2配置
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope?: string;
}

// API请求选项
export interface APIRequestOptions {
  accessToken: string;
  region?: string;
  format?: 'json' | 'xml';
}

// 卡路里查询结果
export interface CalorieInfo {
  dish_name: string;
  matched_food?: string;
  recipe_info?: RecipeInfo;
  calories_per_serving?: number;
  nutrition_info?: NutritionInfo;
  source: 'fatsecret' | 'estimate';
  confidence: 'high' | 'medium' | 'low';
  message: string;
}