import { Fragment, useRef } from 'react';

import { useSavedMealListKeys } from '@/(pages)/customer-shared/useSavedMealListKeys';
import { useSavedMealReorderAnimation } from '@/(pages)/customer-shared/useSavedMealReorderAnimation';
import { usePictureInPicture, useVibrate, useViewInNewWindow } from '@/hooks';

import { Divider } from '@heroui/divider';

import {
	Avatar,
	Card,
	FadeMotionDiv,
	type IFadeMotionDivProps,
	PopoverTrigger,
	Tooltip,
	cn,
} from '@/design/ui/components';

import SavedMealActionRail from '@/(pages)/customer-shared/savedMealActionRail';
import SavedMealIngredientsStrip from '@/(pages)/customer-shared/savedMealIngredientsStrip';
import {
	type IMoveButtonProps,
	MoveButton,
} from '@/(pages)/customer-shared/moveButton';
import RatingAvatarShell from '@/(pages)/customer-shared/ratingAvatarShell';
import { Plus } from '@/(pages)/customer-shared/resultCardAtoms';
import { trackEvent } from '@/components/analytics';
import Sprite from '@/components/sprite';

import {
	isMealRecipeEqual,
	removeFirstMatchingMeal,
} from '@/(pages)/customer-shared/savedMealEquality';
import { swapSavedMeals } from '@/(pages)/customer-shared/swapSavedMeals';
import { CUSTOMER_RATING_MAP } from '@/data';
import { customerNormalStore as customerStore, globalStore } from '@/stores';

export default function SavedMealCard() {
	const {
		CLASSNAME_EXCLUDE_FROM_PIP,
		PipButton,
		containerRef,
		isOpen: isPipOpen,
		isSupported: isPipSupported,
	} = usePictureInPicture({ offset: { height: 32 }, width: 468 });
	const openWindow = useViewInNewWindow();
	const vibrate = useVibrate();

	const {
		animateSavedMealRemove,
		animateSavedMealSwap,
		registerSavedMealContent,
		registerSavedMealRow,
	} = useSavedMealReorderAnimation();

	const isHighAppearance = globalStore.persistence.highAppearance.use();

	const currentCustomerName = customerStore.shared.customer.name.use();
	const savedMeals = customerStore.persistence.meals.use();
	const currentCustomerMeals =
		currentCustomerName === null
			? null
			: (savedMeals[currentCustomerName] ?? null);
	const savedCustomerMeals =
		customerStore.savedCustomerMealsWithEvaluation.use();

	const { getSavedMealKey, removeSavedMealKey } = useSavedMealListKeys(
		currentCustomerName,
		currentCustomerMeals
	);
	const pendingRemoveDataRef = useRef<
		Array<{
			meal: NonNullable<typeof currentCustomerMeals>[number];
			savedMealKey: string;
		}>
	>([]);

	const instance_recipe = customerStore.instances.recipe.get();

	let content: IFadeMotionDivProps['children'];
	let contentTarget: IFadeMotionDivProps['target'];

	if (
		currentCustomerName === null ||
		currentCustomerMeals === null ||
		savedCustomerMeals === null
	) {
		content = null;
		contentTarget = 'null';
	} else {
		const moveMeal = (
			index: number,
			direction: IMoveButtonProps['direction']
		) => {
			vibrate();

			const nextIndex =
				direction === MoveButton.direction.down ? index + 1 : index - 1;
			const newData = swapSavedMeals({
				currentMeals: currentCustomerMeals,
				nextVisibleIndex: nextIndex,
				savedMeals: savedCustomerMeals,
				visibleIndex: index,
			});

			if (newData === null) {
				return;
			}

			const currentEntry = savedCustomerMeals[index];
			const nextEntry = savedCustomerMeals[nextIndex];
			if (currentEntry === undefined || nextEntry === undefined) {
				return;
			}

			animateSavedMealSwap(currentEntry.dataIndex, nextEntry.dataIndex);

			customerStore.persistence.meals[currentCustomerName]?.set(newData);
		};

		const removeMeal = async (
			dataIndex: number,
			savedMealKey: string,
			dividerDataIndex: number | undefined,
			nextRowDataIndex: number | undefined,
			mealToRemove: (typeof currentCustomerMeals)[number],
			beverage: (typeof currentCustomerMeals)[number]['beverage'],
			recipeData: (typeof currentCustomerMeals)[number]['recipe']
		) => {
			pendingRemoveDataRef.current.push({
				meal: mealToRemove,
				savedMealKey,
			});
			vibrate();
			await animateSavedMealRemove(dataIndex, {
				collapseLayout: savedCustomerMeals.length > 1,
				dividerDataIndex,
				nextRowDataIndex,
			});
			const latestCustomerMeals =
				customerStore.persistence.meals[currentCustomerName]?.get() ??
				currentCustomerMeals;
			const pendingRemoveData = pendingRemoveDataRef.current.splice(0);
			if (pendingRemoveData.length > 0) {
				const newData = pendingRemoveData.reduce(
					(meals, { meal: targetMeal, savedMealKey: pendingKey }) => {
						removeSavedMealKey(pendingKey);
						return removeFirstMatchingMeal(
							meals,
							targetMeal,
							(meal, pendingTargetMeal) =>
								meal.beverage === pendingTargetMeal.beverage &&
								isMealRecipeEqual(
									meal.recipe,
									pendingTargetMeal.recipe
								)
						);
					},
					latestCustomerMeals
				);
				customerStore.persistence.meals[currentCustomerName]?.set(
					newData
				);
			}
			trackEvent(
				trackEvent.category.click,
				'Remove Button',
				`${recipeData.name}${beverage === null ? '' : ` - ${beverage}`}${recipeData.extraIngredients.length === 0 ? '' : ` - ${recipeData.extraIngredients.join(' ')}`}`
			);
		};

		content = (
			<Card
				fullWidth
				shadow="sm"
				classNames={{
					base: cn({
						'bg-content1/40 backdrop-blur': isHighAppearance,
					}),
				}}
			>
				<div className="space-y-3 p-4 xl:space-y-2">
					{savedCustomerMeals.map(
						(
							{
								dataIndex,
								evaluation: ratingKey,
								meal: { beverage, recipe: recipeData },
							},
							loopIndex
						) => (
							<Fragment key={getSavedMealKey(dataIndex)}>
								<div
									ref={registerSavedMealRow(dataIndex)}
									className="relative flex flex-col items-center gap-4 md:static md:flex-row"
								>
									<div
										ref={registerSavedMealContent(
											dataIndex
										)}
										className="flex flex-1 flex-col flex-wrap items-center gap-3 md:flex-row md:flex-nowrap"
									>
										{(() => {
											const rating =
												CUSTOMER_RATING_MAP[ratingKey];
											return (
												<RatingAvatarShell
													color={ratingKey}
													content={rating}
													placement="left"
													popoverOffset={10}
													trigger={
														<span className="cursor-pointer">
															<PopoverTrigger>
																<Avatar
																	isBordered
																	showFallback
																	color={
																		ratingKey
																	}
																	fallback={
																		<div />
																	}
																	radius="sm"
																	classNames={{
																		base: 'h-1 w-6 ring-offset-0 md:h-6 md:w-1',
																	}}
																/>
															</PopoverTrigger>
														</span>
													}
												/>
											);
										})()}
										<div className="flex items-center gap-2">
											{(() => {
												const cooker =
													instance_recipe.getPropsByName(
														recipeData.name,
														'cooker'
													);
												const cookerLabel = `点击：在新窗口中查看厨具【${cooker}】的详情`;
												return (
													<Tooltip
														showArrow
														content={cookerLabel}
														offset={8}
													>
														<Sprite
															target="cooker"
															name={cooker}
															size={1.5}
															onPress={() => {
																openWindow(
																	'cookers',
																	cooker
																);
															}}
															aria-label={
																cookerLabel
															}
															role="button"
														/>
													</Tooltip>
												);
											})()}
											{(() => {
												const recipeLabel = `点击：在新窗口中查看料理【${recipeData.name}】的详情`;
												return (
													<Tooltip
														showArrow
														content={recipeLabel}
														offset={4}
													>
														<Sprite
															target="recipe"
															name={
																recipeData.name
															}
															size={2}
															onPress={() => {
																openWindow(
																	'recipes',
																	recipeData.name
																);
															}}
															aria-label={
																recipeLabel
															}
															role="button"
														/>
													</Tooltip>
												);
											})()}
											{beverage !== null &&
												(() => {
													const beverageLabel = `点击：在新窗口中查看酒水【${beverage}】的详情`;
													return (
														<>
															<Plus size={0.75} />
															<Tooltip
																showArrow
																content={
																	beverageLabel
																}
																offset={4}
															>
																<Sprite
																	target="beverage"
																	name={
																		beverage
																	}
																	size={2}
																	onPress={() => {
																		openWindow(
																			'beverages',
																			beverage
																		);
																	}}
																	aria-label={
																		beverageLabel
																	}
																	role="button"
																/>
															</Tooltip>
														</>
													);
												})()}
										</div>
										<Plus size={0.75} />
										<SavedMealIngredientsStrip
											extraIngredients={
												recipeData.extraIngredients
											}
											onOpenIngredient={(name) => {
												openWindow('ingredients', name);
											}}
											originalIngredients={instance_recipe.getPropsByName(
												recipeData.name,
												'ingredients'
											)}
										/>
									</div>
									<SavedMealActionRail
										className={CLASSNAME_EXCLUDE_FROM_PIP}
										isMoveDownDisabled={
											loopIndex ===
											savedCustomerMeals.length - 1
										}
										isMoveUpDisabled={loopIndex === 0}
										isReorderVisible={
											savedCustomerMeals.length > 1
										}
										onMoveDown={() => {
											moveMeal(
												loopIndex,
												MoveButton.direction.down
											);
										}}
										onMoveUp={() => {
											moveMeal(
												loopIndex,
												MoveButton.direction.up
											);
										}}
										onRemove={() => {
											const mealToRemove =
												currentCustomerMeals[dataIndex];
											if (mealToRemove === undefined) {
												return;
											}

											const dividerDataIndex =
												loopIndex <
												savedCustomerMeals.length - 1
													? dataIndex
													: savedCustomerMeals[
															loopIndex - 1
														]?.dataIndex;
											const nextRowDataIndex =
												loopIndex === 0
													? savedCustomerMeals[1]
															?.dataIndex
													: undefined;
											void removeMeal(
												dataIndex,
												getSavedMealKey(dataIndex),
												dividerDataIndex,
												nextRowDataIndex,
												mealToRemove,
												beverage,
												recipeData
											);
										}}
										onSelect={() => {
											vibrate();
											customerStore.shared.beverage.name.set(
												beverage
											);
											customerStore.shared.recipe.data.set(
												recipeData
											);
											trackEvent(
												trackEvent.category.click,
												'Select Button',
												`${recipeData.name}${beverage === null ? '' : ` - ${beverage}`}${recipeData.extraIngredients.length === 0 ? '' : ` - ${recipeData.extraIngredients.join(' ')}`}`
											);
										}}
										reorderButtonsClassName="md:right-0.5 md:top-[unset] md:gap-5 xl:gap-4"
									/>
								</div>
								{loopIndex < savedCustomerMeals.length - 1 && (
									<Divider />
								)}
							</Fragment>
						)
					)}
				</div>
			</Card>
		);
		contentTarget = 'content';
	}

	return isPipSupported ? (
		<div className="group">
			<div
				className={cn('transition-opacity', {
					'pointer-events-none opacity-0': isPipOpen,
				})}
				ref={containerRef}
			>
				<FadeMotionDiv target={contentTarget}>{content}</FadeMotionDiv>
			</div>
			{content !== null && (
				<PipButton
					onOpen={() => {
						trackEvent(
							trackEvent.category.click,
							'PIP Button',
							`${currentCustomerName}`
						);
					}}
				/>
			)}
		</div>
	) : (
		<FadeMotionDiv target={contentTarget}>{content}</FadeMotionDiv>
	);
}
