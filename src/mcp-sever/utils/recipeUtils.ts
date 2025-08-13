import { Recipe, SimpleRecipe, NameOnlyRecipe, Ingredient } from '../types/index.js';

// 创建简化版的Recipe数据
export function simplifyRecipe(recipe: Recipe): SimpleRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    ingredients: recipe.ingredients.map((ingredient: Ingredient) => ({
      name: ingredient.name,
      text_quantity: ingredient.text_quantity
    }))
  };
}

// 创建只包含name和description的Recipe数据
export function simplifyRecipeNameOnly(recipe: Recipe): NameOnlyRecipe {
  return {
    name: recipe.name,
    description: recipe.description
  };
}

// 处理食材清单，收集菜谱的所有食材
export function processRecipeIngredients(recipe: Recipe, ingredientMap: Map<string, {
  totalQuantity: number | null,
  unit: string | null,
  recipeCount: number,
  recipes: string[]
}>) {
  recipe.ingredients?.forEach((ingredient: Ingredient) => {
    const key = ingredient.name.toLowerCase();
    
    if (!ingredientMap.has(key)) {
      ingredientMap.set(key, {
        totalQuantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        recipeCount: 1,
        recipes: [recipe.name]
      });
    } else {
      const existing = ingredientMap.get(key)!;
      
      // 对于有明确数量和单位的食材，进行汇总
      if (existing.unit && ingredient.unit && existing.unit === ingredient.unit && existing.totalQuantity !== null && ingredient.quantity !== null) {
        existing.totalQuantity += ingredient.quantity ?? 0;
      } else {
        // 否则保留 null，表示数量不确定
        existing.totalQuantity = null;
        existing.unit = null;
      }
      
      existing.recipeCount += 1;
      if (!existing.recipes.includes(recipe.name)) {
        existing.recipes.push(recipe.name);
      }
    }
  });
}

// 增强版食材分类系统
export function categorizeIngredients(ingredients: Array<{
  name: string,
  totalQuantity: number | null,
  unit: string | null,
  recipeCount: number,
  recipes: string[]
}>, shoppingPlan: {
  fresh: string[],
  pantry: string[],
  spices: string[],
  others: string[]
}) {
  // 更详细的分类关键词
  const categoryKeywords = {
    spices: {
      keywords: ['盐', '糖', '酱油', '生抽', '老抽', '醋', '陈醋', '香醋', '料酒', '黄酒', '胡椒粉', '黑胡椒', 
                 '白胡椒', '孜然', '辣椒粉', '花椒', '八角', '桂皮', '香叶', '丁香', '肉桂', '五香粉',
                 '十三香', '鸡精', '味精', '蚝油', '芝麻油', '香油', '辣椒油'],
      priority: 3
    },
    fresh: {
      keywords: ['鲜', '新鲜', '肉', '牛肉', '猪肉', '羊肉', '鸡肉', '鸭肉', '鹅肉', '鱼', '虾', '蟹', '贝',
                 '鲍', '蛋', '鸡蛋', '鸭蛋', '奶', '牛奶', '酸奶', '菜', '蔬菜', '菠菜', '白菜', '青菜',
                 '油菜', '小白菜', '生菜', '芹菜', '韭菜', '豆腐', '嫩豆腐', '豆芽', '绿豆芽',
                 '西红柿', '番茄', '土豆', '胡萝卜', '白萝卜', '青萝卜', '洋葱', '大葱', '小葱',
                 '香菇', '木耳', '蘑菇', '平菇', '金针菇', '茄子', '黄瓜', '冬瓜', '南瓜', '丝瓜'],
      priority: 2
    },
    pantry: {
      keywords: ['米', '大米', '糯米', '小米', '面粉', '面', '挂面', '意面', '粉条', '粉丝', '淀粉',
                 '玉米淀粉', '土豆淀粉', '油', '菜油', '花生油', '橄榄油', '玉米油', '葵花籽油',
                 '豆', '黄豆', '绿豆', '红豆', '黑豆', '扁豆', '干货', '干香菇', '干木耳', '海带',
                 '紫菜', '银耳', '红枣', '枸杞', '桂圆', '莲子', '百合'],
      priority: 1
    }
  };

  // 按优先级分类食材
  ingredients.forEach(ingredient => {
    const name = ingredient.name.toLowerCase();
    let categorized = false;

    // 按优先级检查分类
    const categories = Object.entries(categoryKeywords).sort((a, b) => b[1].priority - a[1].priority);
    
    for (const [category, data] of categories) {
      if (data.keywords.some(keyword => name.includes(keyword))) {
        switch (category) {
          case 'spices':
            shoppingPlan.spices.push(ingredient.name);
            break;
          case 'fresh':
            shoppingPlan.fresh.push(ingredient.name);
            break;
          case 'pantry':
            shoppingPlan.pantry.push(ingredient.name);
            break;
        }
        categorized = true;
        break;
      }
    }

    // 未分类的放入others
    if (!categorized) {
      shoppingPlan.others.push(ingredient.name);
    }
  });

  // 去重并排序
  shoppingPlan.fresh = Array.from(new Set(shoppingPlan.fresh)).sort();
  shoppingPlan.pantry = Array.from(new Set(shoppingPlan.pantry)).sort();
  shoppingPlan.spices = Array.from(new Set(shoppingPlan.spices)).sort();
  shoppingPlan.others = Array.from(new Set(shoppingPlan.others)).sort();
} 