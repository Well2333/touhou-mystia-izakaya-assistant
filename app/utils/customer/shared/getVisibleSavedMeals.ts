import { isNil } from 'lodash';

import {
	type TBeverageName,
	type TDlc,
	type TIngredientName,
	type TRecipeName,
} from '@/data';
import { checkArrayContainsOf, checkLengthEmpty } from '@/utilities';

export interface IVisibleSavedMealEntry<TMeal> {
	dataIndex: number;
	meal: TMeal;
	visibleIndex: number;
}

export function getVisibleSavedMeals<TMeal>({
	hiddenBeverages = new Set<TBeverageName>(),
	hiddenDlcs,
	hiddenIngredients = new Set<TIngredientName>(),
	hiddenRecipes = new Set<TRecipeName>(),
	meals,
	resolveDlcRefs,
	resolveItemRefs,
}: {
	hiddenBeverages?: ReadonlySet<TBeverageName>;
	hiddenDlcs: ReadonlySet<TDlc>;
	hiddenIngredients?: ReadonlySet<TIngredientName>;
	hiddenRecipes?: ReadonlySet<TRecipeName>;
	meals: ReadonlyArray<TMeal> | null | undefined;
	resolveDlcRefs: (
		meal: TMeal
	) => {
		beverageDlc: TDlc;
		ingredientDlcs: ReadonlyArray<TDlc>;
		recipeDlc: TDlc;
	} | null;
	resolveItemRefs?: (
		meal: TMeal
	) => {
		beverageName: TBeverageName | null;
		ingredientNames: ReadonlyArray<TIngredientName>;
		recipeName: TRecipeName;
	} | null;
}): Array<IVisibleSavedMealEntry<TMeal>> {
	if (isNil(meals) || checkLengthEmpty(meals)) {
		return [];
	}

	const visibleMeals: Array<IVisibleSavedMealEntry<TMeal>> = [];

	meals.forEach((meal, dataIndex) => {
		const dlcRefs = resolveDlcRefs(meal);
		if (dlcRefs === null) {
			return;
		}

		const hasHiddenIngredientDlc = dlcRefs.ingredientDlcs.some((dlc) =>
			hiddenDlcs.has(dlc)
		);
		if (
			hasHiddenIngredientDlc ||
			hiddenDlcs.has(dlcRefs.beverageDlc) ||
			hiddenDlcs.has(dlcRefs.recipeDlc)
		) {
			return;
		}

		const itemRefs = resolveItemRefs?.(meal);
		if (itemRefs === null) {
			return;
		}
		if (
			itemRefs !== undefined &&
			((itemRefs.beverageName !== null &&
				hiddenBeverages.has(itemRefs.beverageName)) ||
				hiddenRecipes.has(itemRefs.recipeName) ||
				checkArrayContainsOf(
					itemRefs.ingredientNames,
					hiddenIngredients
				))
		) {
			return;
		}

		visibleMeals.push({
			dataIndex,
			meal,
			visibleIndex: visibleMeals.length,
		});
	});

	return visibleMeals;
}
