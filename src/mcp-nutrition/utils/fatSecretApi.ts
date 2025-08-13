import { getFatSecretOAuth2Client } from '../auth/oauth2';
import { AutocompleteResponse, RecipeInfo, FoodSuggestion, NutritionInfo } from '../types';

export class FatSecretAPI {
  private baseUrl = 'https://platform.fatsecret.com/rest';

  // 食物名称自动补全
  async searchFoodAutocomplete(expression: string, maxResults: number = 4): Promise<FoodSuggestion[]> {
    try {
      const oauth2Client = getFatSecretOAuth2Client();
      const authHeaders = await oauth2Client.getAuthHeaders();

      const params = new URLSearchParams({
        expression,
        max_results: maxResults.toString(),
        format: "json",
        region: "CN"
      });

      const response = await fetch(`${this.baseUrl}/food/autocomplete/v2?${params}`, {
        headers: authHeaders
      });

      if (!response.ok) {
        throw new Error(`FatSecret autocomplete API error: ${response.status} ${response.statusText}`);
      }

      const data: AutocompleteResponse = await response.json();
      console.log('FatSecret autocomplete response:', data);
      // 处理API响应格式的差异
      if (data.suggestions && data.suggestions.suggestion) {
        // 确保返回数组格式
        const suggestions = Array.isArray(data.suggestions.suggestion) 
          ? data.suggestions.suggestion 
          : [data.suggestions.suggestion];
        
        return suggestions.map(suggestion => ({
          food_name: suggestion.food_name,
          food_id: suggestion.food_id
        }));
      }

      return [];
    } catch (error) {
      console.error('FatSecret autocomplete search failed:', error);
      throw error;
    }
  }

  // 根据食谱ID获取详细信息（包括营养成分）
  async getRecipeById(recipeId: string): Promise<RecipeInfo | null> {
    try {
      const oauth2Client = getFatSecretOAuth2Client();
      const authHeaders = await oauth2Client.getAuthHeaders();

      const params = new URLSearchParams({
        recipe_id: recipeId,
        format: 'json'
      });

      const response = await fetch(`${this.baseUrl}/recipe/v2?${params}`, {
        headers: authHeaders
      });

      if (!response.ok) {
        throw new Error(`FatSecret recipe API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { recipe?: any };
      
      if (data.recipe) {
        return this.parseRecipeData(data.recipe);
      }

      return null;
    } catch (error) {
      console.error('FatSecret recipe get failed:', error);
      throw error;
    }
  }

  // 搜索食品并获取第一个匹配项的营养信息
  async searchFoodAndGetNutrition(dishName: string): Promise<{ 
    matchedFood: string; 
    nutritionInfo: NutritionInfo;
    confidence: 'high' | 'medium' | 'low';
  } | null> {
    try {
      // 首先进行自动补全搜索
      const suggestions = await this.searchFoodAutocomplete(dishName, 1);
      
      if (suggestions.length === 0) {
        return null;
      }

      const bestMatch = suggestions[0];
      
      // 如果有food_id，可以进一步获取详细营养信息
      // 注意：这里假设FatSecret API提供了food.get端点来获取食品详情
      if (bestMatch.food_id) {
        const nutritionInfo = await this.getFoodNutrition(bestMatch.food_id);
        if (nutritionInfo) {
          return {
            matchedFood: bestMatch.food_name,
            nutritionInfo,
            confidence: this.calculateMatchConfidence(dishName, bestMatch.food_name)
          };
        }
      }

      // 如果无法获取详细营养信息，返回基本匹配信息
      return {
        matchedFood: bestMatch.food_name,
        nutritionInfo: this.getEstimatedNutrition(bestMatch.food_name),
        confidence: this.calculateMatchConfidence(dishName, bestMatch.food_name)
      };
    } catch (error) {
      console.error('Search food and get nutrition failed:', error);
      return null;
    }
  }

  // 根据食品ID获取营养信息（假设的API端点）
  private async getFoodNutrition(foodId: string): Promise<NutritionInfo | null> {
    try {
      const oauth2Client = getFatSecretOAuth2Client();
      const authHeaders = await oauth2Client.getAuthHeaders();

      const params = new URLSearchParams({
        food_id: foodId,
        format: 'json'
      });

      const response = await fetch(`${this.baseUrl}/food/v2?${params}`, {
        headers: authHeaders
      });

      if (response.ok) {
        const data = await response.json() as { food?: { servings?: { serving: any[] } } };
        if (data.food && data.food.servings) {
          return this.parseNutritionData(data.food.servings.serving[0]);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Get food nutrition failed:', error);
      return null;
    }
  }

  // 解析食谱数据
  private parseRecipeData(recipeData: any): RecipeInfo {
    return {
      recipe_id: recipeData.recipe_id,
      recipe_name: recipeData.recipe_name,
      recipe_description: recipeData.recipe_description || '',
      recipe_url: recipeData.recipe_url || '',
      servings: parseInt(recipeData.number_of_servings) || 1,
      preparation_time: parseInt(recipeData.preparation_time_min) || 0,
      cooking_time: parseInt(recipeData.cooking_time_min) || 0,
      nutrition_info: this.parseNutritionData(recipeData),
      ingredients: this.parseIngredients(recipeData.ingredients),
      directions: this.parseDirections(recipeData.directions)
    };
  }

  // 解析营养信息
  private parseNutritionData(data: any): NutritionInfo {
    return {
      calories: parseFloat(data.calories) || 0,
      carbohydrate: parseFloat(data.carbohydrate) || 0,
      protein: parseFloat(data.protein) || 0,
      fat: parseFloat(data.fat) || 0,
      fiber: parseFloat(data.fiber) || 0,
      sugar: parseFloat(data.sugar) || 0,
      sodium: parseFloat(data.sodium) || 0,
      cholesterol: parseFloat(data.cholesterol) || 0,
      saturated_fat: parseFloat(data.saturated_fat) || 0,
      polyunsaturated_fat: parseFloat(data.polyunsaturated_fat) || 0,
      monounsaturated_fat: parseFloat(data.monounsaturated_fat) || 0
    };
  }

  // 解析配料列表
  private parseIngredients(ingredients: any): string[] {
    if (!ingredients || !ingredients.ingredient) return [];
    
    const ingredientList = Array.isArray(ingredients.ingredient) 
      ? ingredients.ingredient 
      : [ingredients.ingredient];
    
    return ingredientList.map((ing: any) => ing.ingredient_description || ing.toString());
  }

  // 解析制作步骤
  private parseDirections(directions: any): string[] {
    if (!directions || !directions.direction) return [];
    
    const directionList = Array.isArray(directions.direction) 
      ? directions.direction 
      : [directions.direction];
    
    return directionList.map((dir: any) => dir.direction_description || dir.toString());
  }

  // 计算匹配置信度
  private calculateMatchConfidence(dishName: string, matchedName: string): 'high' | 'medium' | 'low' {
    const dish = dishName.toLowerCase().trim();
    const matched = matchedName.toLowerCase().trim();
    
    if (dish === matched) return 'high';
    if (matched.includes(dish) || dish.includes(matched)) return 'medium';
    
    // 简单的词汇相似度检查
    const dishWords = dish.split(/\s+/);
    const matchedWords = matched.split(/\s+/);
    const commonWords = dishWords.filter(word => matchedWords.some(mWord => mWord.includes(word)));
    
    if (commonWords.length / dishWords.length > 0.5) return 'medium';
    return 'low';
  }

  // 获取估计的营养信息（当无法获取准确数据时）
  private getEstimatedNutrition(foodName: string): NutritionInfo {
    // 这是一个简单的估算，实际应用中可能需要更复杂的算法
    const baseCalories = 150; // 基础卡路里
    const estimatedCalories = this.estimateCalories(foodName);
    
    return {
      calories: estimatedCalories,
      carbohydrate: estimatedCalories * 0.5 / 4, // 假设50%来自碳水化合物
      protein: estimatedCalories * 0.25 / 4,     // 假设25%来自蛋白质  
      fat: estimatedCalories * 0.25 / 9,         // 假设25%来自脂肪
      fiber: 2,
      sugar: 5,
      sodium: 200,
      cholesterol: 10,
      saturated_fat: 2,
      polyunsaturated_fat: 1,
      monounsaturated_fat: 2
    };
  }

  // 简单的卡路里估算
  private estimateCalories(foodName: string): number {
    const name = foodName.toLowerCase();
    
    // 简单的食物分类和卡路里估算
    if (name.includes('salad') || name.includes('vegetable')) return 50;
    if (name.includes('fruit')) return 80;
    if (name.includes('chicken') || name.includes('fish')) return 200;
    if (name.includes('beef') || name.includes('pork')) return 250;
    if (name.includes('pasta') || name.includes('rice')) return 300;
    if (name.includes('cake') || name.includes('dessert')) return 400;
    
    return 150; // 默认估算
  }
}

// 单例模式
let fatSecretAPI: FatSecretAPI | null = null;

export function getFatSecretAPI(): FatSecretAPI {
  if (!fatSecretAPI) {
    fatSecretAPI = new FatSecretAPI();
  }
  return fatSecretAPI;
}