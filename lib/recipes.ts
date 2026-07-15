export type RecipeCategoryId = 'meat' | 'side' | 'dessert' | 'drink'

export const RECIPE_CATEGORIES: { id: RecipeCategoryId; badge: string; name: string; sub: string }[] = [
  { id: 'meat', badge: '肉', name: '肉', sub: '提供するお肉のレシピ' },
  { id: 'side', badge: '菜', name: 'サイドメニュー', sub: 'サラダ・スープなど' },
  { id: 'dessert', badge: '甘', name: 'デザート', sub: '杏仁・ブリュレなど' },
  { id: 'drink', badge: '飲', name: 'ドリンク', sub: 'サワー・フリージングなど' },
]
