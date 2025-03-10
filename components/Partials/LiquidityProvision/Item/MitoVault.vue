<script setup lang="ts">
import { getMitoUrl } from '@shared/utils/network'
import { LiquidityProvisionMitoCard } from '@/types'

const props = defineProps({
  vault: {
    type: Object as PropType<LiquidityProvisionMitoCard>,
    required: true
  }
})

const spotStore = useSpotStore()
const derivativeStore = useDerivativeStore()

const market = computed(() =>
  [...derivativeStore.markets, ...spotStore.markets].find(
    (market) => market.marketId === props.vault.marketId
  )
)

const mitoUrl = `${getMitoUrl()}/vault/${props.vault.contractAddress}/`

const { valueToString: tvlToString } = useSharedBigNumberFormatter(
  computed(() => props.vault.tvl),
  { decimalPlaces: 0 }
)
</script>

<template>
  <PartialsLiquidityProvisionItem
    v-if="market"
    v-bind="{
      url: mitoUrl,
      title: market.ticker,
      description: $t(`liquidityProvision.item.type.${props.vault.type}`)
    }"
  >
    <template #default>
      <CommonTokenIcon is-lg v-bind="{ token: market?.baseToken }" />
    </template>

    <template #source>
      <AssetMitoLogo class="left-1 relative" />
    </template>

    <template #content>
      <div class="min-w-0 truncate">
        <p class="text-gray-300 text-sm">{{ $t('liquidityProvision.TVL') }}</p>
        <p class="text-xl font-semibold truncate">${{ tvlToString }}</p>
      </div>

      <div class="min-w-0 truncate">
        <p class="text-gray-300 text-sm">{{ $t('liquidityProvision.APY') }}</p>
        <p class="text-green-500 text-xl font-semibold truncate">
          {{ vault.apyToShow }}%
        </p>
      </div>
    </template>
  </PartialsLiquidityProvisionItem>
</template>
