<script setup lang="ts">
import { BigNumberInBase } from '@injectivelabs/utils'
import {
  isSgtSubaccountId,
  getSubaccountIndex,
  getMarketSlugFromSubaccountId
} from '@/app/utils/helpers'
import { DUST_AMOUNT_THRESHOLD } from '@/app/utils/constants'

const props = defineProps({
  showLowBalance: Boolean,
  includeBotsSubaccounts: Boolean
})

const accountStore = useAccountStore()
const sharedWalletStore = useSharedWalletStore()
const { t } = useLang()
const { aggregatedPortfolioBalances } = useBalance()

onMounted(() => {
  const isSubaccountOptionAvailable = subaccountOptionsFiltered.value.some(
    (option) => option.value === accountStore.subaccountId
  )

  if (isSubaccountOptionAvailable) {
    return
  }

  const defaultSubaccountId = Object.keys(accountStore.subaccountBalancesMap)[0]

  if (defaultSubaccountId) {
    accountStore.updateSubaccount(defaultSubaccountId)
  }
})

const subaccountOptions = computed(() =>
  Object.keys(aggregatedPortfolioBalances.value)
    .map((value) => {
      if (getSubaccountIndex(value) === 0) {
        return { display: `${t('account.main')}`, value }
      }

      if (isSgtSubaccountId(value)) {
        return {
          value,
          display: `SGT ${getMarketSlugFromSubaccountId(value)}`
        }
      }

      return {
        value,
        display: getSubaccountIndex(value).toString()
      }
    })
    .sort((a, b) => a.value.localeCompare(b.value))
)

const subaccountOptionsFiltered = computed(() =>
  subaccountOptions.value.filter(({ value: subaccountId }) => {
    const includeBotsSubaccounts =
      props.includeBotsSubaccounts || !isSgtSubaccountId(subaccountId)

    const hasBalance = aggregatedPortfolioBalances.value[subaccountId]?.some(
      (balance) =>
        new BigNumberInBase(balance.accountTotalBalance).gte(
          DUST_AMOUNT_THRESHOLD
        )
    )

    const includeLowBalance =
      props.showLowBalance ||
      hasBalance ||
      subaccountId === sharedWalletStore.defaultSubaccountId

    return includeBotsSubaccounts && includeLowBalance
  })
)

const activeSubaccountLabel = computed(
  () =>
    subaccountOptions.value.find(
      (option) => option.value === accountStore.subaccountId
    )?.display
)
</script>

<template>
  <slot
    v-bind="{
      subaccountOptions: subaccountOptionsFiltered,
      activeSubaccountLabel
    }"
  />
</template>
