import {
  Msgs,
  ExitType,
  MsgGrant,
  ExitConfig,
  MsgExecuteContractCompat,
  ExecArgRemoveGridStrategy,
  spotPriceToChainPriceToFixed,
  ExecArgCreateSpotGridStrategy,
  spotQuantityToChainQuantityToFixed,
  getGenericAuthorizationFromMessageType
} from '@injectivelabs/sdk-ts'
import { BigNumberInBase } from '@injectivelabs/utils'
import { GeneralException } from '@injectivelabs/exceptions'
import { backupPromiseCall } from '@/app/utils/async'
import spotGridMarkets from '@/app/data/spotGridMarkets.json'
import { addressAndMarketSlugToSubaccountId } from '@/app/utils/helpers'
import { gridStrategyAuthorizationMessageTypes } from '@/app/data/grid-strategy'
import {
  UiSpotMarket,
  SpotGridTradingForm,
  SpotGridTradingField
} from '@/types'

export const createStrategy = async (
  {
    [SpotGridTradingField.Grids]: grids,
    [SpotGridTradingField.StopLoss]: stopLoss,
    [SpotGridTradingField.ExitType]: exitType,
    [SpotGridTradingField.UpperPrice]: upperPrice,
    [SpotGridTradingField.LowerPrice]: lowerPrice,
    [SpotGridTradingField.TakeProfit]: takeProfit,
    [SpotGridTradingField.SettleIn]: isSettleInEnabled,
    [SpotGridTradingField.QuoteInvestmentAmount]: quoteAmount,
    [SpotGridTradingField.BaseInvestmentAmount]: baseAmount,
    [SpotGridTradingField.SellBaseOnStopLoss]: isSellBaseOnStopLossEnabled,
    [SpotGridTradingField.BuyBaseOnTakeProfit]: isBuyBaseOnTakeProfitEnabled,
    [SpotGridTradingField.StrategyType]: strategyType
  }: Partial<SpotGridTradingForm>,
  market?: UiSpotMarket
) => {
  const authZStore = useAuthZStore()
  const walletStore = useWalletStore()
  const accountStore = useAccountStore()
  const sharedWalletStore = useSharedWalletStore()
  const gridStrategyStore = useGridStrategyStore()

  const levels = Number(grids)

  if (!sharedWalletStore.injectiveAddress) {
    return
  }

  if (!baseAmount && !quoteAmount) {
    return
  }

  if (!lowerPrice || !upperPrice) {
    return
  }

  await walletStore.validate()

  if (sharedWalletStore.isAuthzWalletConnected) {
    throw new GeneralException(new Error('AuthZ not supported for this action'))
  }

  const actualMarket = market || gridStrategyStore.spotMarket

  if (!actualMarket) {
    return
  }

  const gridMarket = spotGridMarkets.find(
    (market) => market.slug === actualMarket.slug
  )

  if (!gridMarket) {
    return
  }

  const gridStrategySubaccountId = addressAndMarketSlugToSubaccountId(
    sharedWalletStore.address,
    gridMarket.slug
  )

  const funds = []

  if (baseAmount && !new BigNumberInBase(baseAmount).eq(0)) {
    funds.push({
      denom: actualMarket.baseToken.denom,
      amount: spotQuantityToChainQuantityToFixed({
        value: baseAmount,
        baseDecimals: actualMarket.baseToken.decimals
      })
    })
  }

  if (quoteAmount && !new BigNumberInBase(quoteAmount).eq(0)) {
    funds.push({
      denom: actualMarket.quoteToken.denom,
      amount: spotQuantityToChainQuantityToFixed({
        value: quoteAmount,
        baseDecimals: actualMarket.quoteToken.decimals
      })
    })
  }

  const stopLossValue: ExitConfig | undefined = stopLoss
    ? {
        exitPrice: spotPriceToChainPriceToFixed({
          value: stopLoss,
          baseDecimals: actualMarket.baseToken.decimals,
          quoteDecimals: actualMarket.quoteToken.decimals
        }),
        exitType: isSellBaseOnStopLossEnabled
          ? ExitType.Quote
          : ExitType.Default
      }
    : undefined

  const takeProfitValue: ExitConfig | undefined = takeProfit
    ? {
        exitPrice: spotPriceToChainPriceToFixed({
          value: takeProfit,
          baseDecimals: actualMarket.baseToken.decimals,
          quoteDecimals: actualMarket.quoteToken.decimals
        }),
        exitType: isBuyBaseOnTakeProfitEnabled
          ? ExitType.Base
          : ExitType.Default
      }
    : undefined

  const message = MsgExecuteContractCompat.fromJSON({
    contractAddress: gridMarket.contractAddress,
    sender: sharedWalletStore.injectiveAddress,
    execArgs: ExecArgCreateSpotGridStrategy.fromJSON({
      levels,
      stopLoss: stopLossValue,
      takeProfit: takeProfitValue,
      subaccountId: gridStrategySubaccountId,
      lowerBound: spotPriceToChainPriceToFixed({
        value: lowerPrice,
        baseDecimals: actualMarket.baseToken.decimals,
        quoteDecimals: actualMarket.quoteToken.decimals
      }),
      upperBound: spotPriceToChainPriceToFixed({
        value: upperPrice,
        baseDecimals: actualMarket.baseToken.decimals,
        quoteDecimals: actualMarket.quoteToken.decimals
      }),
      exitType: isSettleInEnabled && exitType ? exitType : ExitType.Default,
      strategyType
    }),

    funds
  })

  const grantAuthZMessages = gridStrategyAuthorizationMessageTypes.map(
    (messageType) =>
      MsgGrant.fromJSON({
        grantee: gridMarket.contractAddress,
        granter: sharedWalletStore.injectiveAddress,
        authorization: getGenericAuthorizationFromMessageType(messageType)
      })
  )

  const isAuthorized = gridStrategyAuthorizationMessageTypes.every((m) =>
    authZStore.granterGrants.some(
      (grant) =>
        grant.authorizationType.endsWith(m) &&
        grant.grantee === gridMarket?.contractAddress
    )
  )

  const messages: Msgs[] = []

  if (!isAuthorized) {
    messages.push(...grantAuthZMessages)
  }
  // we need to add it after the authz messages
  messages.push(message)

  await sharedWalletStore.broadcastWithFeeDelegation({ messages })

  backupPromiseCall(() =>
    Promise.all([
      authZStore.fetchGrants(),
      accountStore.fetchCw20Balances(),
      gridStrategyStore.fetchAllStrategies(),
      accountStore.fetchAccountPortfolioBalances()
    ])
  )
}

export const removeStrategy = async (contractAddress?: string) => {
  const walletStore = useWalletStore()
  const accountStore = useAccountStore()
  const sharedWalletStore = useSharedWalletStore()
  const gridStrategyStore = useGridStrategyStore()

  if (!sharedWalletStore.isUserConnected) {
    return
  }

  if (!gridStrategyStore.spotMarket) {
    return
  }

  await walletStore.validate()

  if (sharedWalletStore.isAuthzWalletConnected) {
    throw new GeneralException(new Error('AuthZ not supported for this action'))
  }

  const gridMarket = spotGridMarkets.find(
    (m) => m.slug === gridStrategyStore.spotMarket!.slug
  )

  if (!gridMarket) {
    return
  }

  const gridStrategySubaccountId = addressAndMarketSlugToSubaccountId(
    sharedWalletStore.address,
    gridStrategyStore.spotMarket.slug
  )

  const messages = MsgExecuteContractCompat.fromJSON({
    contractAddress: contractAddress || gridMarket.contractAddress,
    sender: sharedWalletStore.injectiveAddress,
    execArgs: ExecArgRemoveGridStrategy.fromJSON({
      subaccountId: gridStrategySubaccountId
    })
  })

  await sharedWalletStore.broadcastWithFeeDelegation({ messages })

  backupPromiseCall(() =>
    Promise.all([
      accountStore.fetchCw20Balances(),
      gridStrategyStore.fetchAllStrategies(),
      accountStore.fetchAccountPortfolioBalances()
    ])
  )
}

export const removeStrategyForSubaccount = async (
  contractAddress?: string,
  subaccountId?: string
) => {
  const walletStore = useWalletStore()
  const accountStore = useAccountStore()
  const gridStrategyStore = useGridStrategyStore()
  const sharedWalletStore = useSharedWalletStore()

  if (!sharedWalletStore.isUserConnected) {
    return
  }

  if (!contractAddress) {
    return
  }

  await walletStore.validate()

  if (sharedWalletStore.isAuthzWalletConnected) {
    throw new GeneralException(new Error('AuthZ not supported for this action'))
  }

  const messages = MsgExecuteContractCompat.fromJSON({
    contractAddress,
    sender: sharedWalletStore.injectiveAddress,
    execArgs: ExecArgRemoveGridStrategy.fromJSON({
      subaccountId: subaccountId || accountStore.subaccountId
    })
  })

  await sharedWalletStore.broadcastWithFeeDelegation({ messages })

  backupPromiseCall(() =>
    Promise.all([
      accountStore.fetchCw20Balances(),
      gridStrategyStore.fetchAllStrategies(),
      accountStore.fetchAccountPortfolioBalances()
    ])
  )
}
