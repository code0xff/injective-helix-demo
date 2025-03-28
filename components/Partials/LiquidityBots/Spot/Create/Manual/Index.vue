<script lang="ts" setup>
import {
  UI_DEFAULT_MAX_DISPLAY_DECIMALS,
  UI_DEFAULT_MIN_DISPLAY_DECIMALS,
  UI_DEFAULT_LOW_PRICE_DISPLAY_DECIMALS,
  UI_DEFAULT_PRICE_MAX_DECIMALS,
  UI_DEFAULT_PRICE_MIN_DECIMALS
} from '@/app/utils/constants'
import {
  UiSpotMarket,
  InvestmentTypeGst,
  SpotGridTradingForm,
  SpotGridTradingField
} from '@/types'

const spotStore = useSpotStore()
const setFormValues = useSetFormValues()
const sharedWalletStore = useSharedWalletStore()
const gridStrategyStore = useGridStrategyStore()
const liquidityFormValues = useFormValues<SpotGridTradingForm>()

const setUpperPriceField = useSetFieldValue(SpotGridTradingField.UpperPrice)
const setLowerPriceField = useSetFieldValue(SpotGridTradingField.LowerPrice)

const min = ref('')
const max = ref('')
const isAssetReBalancingChecked = ref(true)

const { lastTradedPrice } = useSpotLastPrice(
  computed(() => gridStrategyStore.spotMarket!)
)

const upperPriceValue = computed({
  get: () => liquidityFormValues.value[SpotGridTradingField.UpperPrice] || '',
  set: (value) => {
    setUpperPriceField(Number(value).toFixed(decimalPlaces.value))
  }
})

const lowerPriceValue = computed({
  get: () => liquidityFormValues.value[SpotGridTradingField.LowerPrice] || '',
  set: (value) => {
    setLowerPriceField(Number(value).toFixed(decimalPlaces.value))
  }
})

const isBaseAndQuoteType = computed(
  () =>
    liquidityFormValues.value[SpotGridTradingField.InvestmentType] ===
    InvestmentTypeGst.BaseAndQuote
)

const decimalPlaces = computed(() => {
  if (lastTradedPrice.value.isGreaterThan(UI_DEFAULT_PRICE_MIN_DECIMALS)) {
    return UI_DEFAULT_MIN_DISPLAY_DECIMALS
  }

  if (lastTradedPrice.value.isGreaterThan(UI_DEFAULT_PRICE_MAX_DECIMALS)) {
    return UI_DEFAULT_MAX_DISPLAY_DECIMALS
  }

  return UI_DEFAULT_LOW_PRICE_DISPLAY_DECIMALS
})

onMounted(() => {
  if (lastTradedPrice.value.gt(0)) {
    setFormValues(
      {
        [SpotGridTradingField.LowerPrice]: lastTradedPrice.value
          .minus(lastTradedPrice.value.times(0.06))
          .toFixed(decimalPlaces.value),
        [SpotGridTradingField.UpperPrice]: lastTradedPrice.value
          .plus(lastTradedPrice.value.times(0.06))
          .toFixed(decimalPlaces.value)
      },
      false
    )

    min.value = lastTradedPrice.value
      .minus(lastTradedPrice.value.times(0.2))
      .toFixed(decimalPlaces.value)
    max.value = lastTradedPrice.value
      .plus(lastTradedPrice.value.times(0.2))
      .toFixed(decimalPlaces.value)
  } else {
    setFormValues(
      {
        [SpotGridTradingField.UpperPrice]: '2',
        [SpotGridTradingField.LowerPrice]: '1'
      },
      false
    )
  }
})

function zoomIn() {
  const currentPrice = lastTradedPrice.value.toNumber()
  const minPrice = Number(min.value)
  const maxPrice = Number(max.value)

  animate(min, (minPrice + (currentPrice - minPrice) / 5).toString())
  animate(max, (maxPrice - (maxPrice - currentPrice) / 5).toString())
}
function zoomOut() {
  const currentPrice = lastTradedPrice.value.toNumber()
  const minPrice = Number(min.value)
  const maxPrice = Number(max.value)

  animate(min, (minPrice - (currentPrice - minPrice) / 5).toString())
  animate(max, (maxPrice + (maxPrice - currentPrice) / 5).toString())
}

const animate = (refValue: Ref, targetValue: string, duration = 200) => {
  const startTime = performance.now()
  const startValue = +refValue.value

  const update = (currentTime: any) => {
    const progress = (currentTime - startTime) / duration

    if (progress < 1) {
      refValue.value = (
        startValue +
        (+targetValue - startValue) * progress
      ).toString()

      requestAnimationFrame(update)
    } else {
      refValue.value = targetValue
    }
  }

  requestAnimationFrame(update)
}

watch(isBaseAndQuoteType, (value) => {
  if (!value) {
    isAssetReBalancingChecked.value = true
  }
})
</script>

<template>
  <div>
    <PartialsLiquidityBotsSpotCreateManualUpperLowerBounds
      v-bind="{
        market: gridStrategyStore.spotMarket!,
        isRebalanceBeforeCreationChecked:
          !isBaseAndQuoteType && isAssetReBalancingChecked
      }"
    />

    <PartialsLiquidityBotsSpotCreateManualCurrentPrice
      v-bind="{
        market: gridStrategyStore.spotMarket as UiSpotMarket,
        decimalPlaces
      }"
    />

    <PartialsLiquidityBotsSpotCreateManualRangeInput
      v-if="min && max"
      v-model:lower="lowerPriceValue"
      v-model:max="max"
      v-model:min="min"
      v-model:upper="upperPriceValue"
      v-bind="{
        currentPrice: lastTradedPrice.toFixed(),
        market: gridStrategyStore.spotMarket,
        orderbook: spotStore.orderbook,
        decimalPlaces
      }"
    />

    <div class="space-x-2 py-2 flex justify-end">
      <button class="border p-2 rounded-md" @click="zoomIn">
        <SharedIcon name="plus" is-xs />
      </button>
      <button class="border px-2 rounded-md" @click="zoomOut">
        <SharedIcon name="minus" is-xs />
      </button>
    </div>

    <PartialsLiquidityBotsSpotCreateManualGrids />

    <PartialsLiquidityBotsSpotCreateCommonInvestmentType
      class="my-4"
      v-bind="{ market: gridStrategyStore.spotMarket! }"
    />

    <div class="flex justify-end mb-2 sm:-mb-4">
      <div v-if="!isBaseAndQuoteType" class="flex items-center">
        <LazyAppCheckbox2 v-model="isAssetReBalancingChecked">
          {{ $t('liquidity.allowAssetRebalance') }}
        </LazyAppCheckbox2>

        <AppTooltip
          v-bind="{
            content: $t('liquidity.allowAssetRebalanceTooltip')
          }"
        />
      </div>
    </div>

    <PartialsLiquidityBotsSpotCreateCommonInvestmentAmount
      v-bind="{
        market: gridStrategyStore.spotMarket!,
        grids: liquidityFormValues[SpotGridTradingField.Grids] || '0'
      }"
      class="mb-4"
    />

    <CommonUserNotConnectedNote v-if="!sharedWalletStore.isUserConnected" cta />

    <PartialsLiquidityBotsSpotCreateCommonCreateStrategy
      v-else
      v-bind="{ market: gridStrategyStore.spotMarket! }"
    />
  </div>
</template>
