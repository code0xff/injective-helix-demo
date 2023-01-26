import { StreamOperation } from '@injectivelabs/ts-types'
import {
  DerivativeOrderSide,
  DerivativeOrderState
} from '@injectivelabs/sdk-ts'
import {
  MarketType,
  UiDerivativeMarketWithToken
} from '@injectivelabs/sdk-ui-ts'
import {
  streamOrderbook as grpcStreamsOrderbook,
  streamTrades as grpcStreamsTrades,
  streamSubaccountOrders as grpcStreamsSubaccountOrders,
  streamSubaccountOrderHistory as grpcStreamsSubaccountOrderHistory,
  streamSubaccountTrades as grpcStreamsSubaccountTrades,
  streamMarketMarkPrice as grpcStreamsMarketMarkPrice,
  cancelSubaccountOrderHistoryStream as grpcCancelSubaccountOrderHistoryStream,
  cancelSubaccountOrdersStream as grpcCancelSubaccountOrdersStream,
  cancelSubaccountTradesStream as grpcCancelSubaccountTradesStream
} from '@/app/client/streams/derivatives'

export const streamOrderbook = (marketId: string) => {
  const derivativeStore = useDerivativeStore()

  grpcStreamsOrderbook({
    marketId,
    callback: ({ orderbook }) => {
      if (!orderbook) {
        return
      }

      derivativeStore.$patch({
        orderbook
      })
    }
  })
}

export const streamTrades = (marketId: string) => {
  const derivativeStore = useDerivativeStore()

  grpcStreamsTrades({
    marketId,
    callback: ({ trade, operation }) => {
      if (!trade) {
        return
      }

      switch (operation) {
        case StreamOperation.Insert:
          derivativeStore.$patch({
            trades: [trade, ...derivativeStore.trades]
          })
      }
    }
  })
}

export const cancelSubaccountOrdersStream = () => {
  grpcCancelSubaccountOrdersStream()
}

export const cancelSubaccountOrderHistoryStream = () =>
  grpcCancelSubaccountOrderHistoryStream()

export const streamSubaccountOrderHistory = (marketId?: string) => {
  const derivativeStore = useDerivativeStore()
  const { subaccount } = useAccountStore()
  const { isUserWalletConnected } = useWalletStore()

  if (!isUserWalletConnected || !subaccount) {
    return
  }

  grpcStreamsSubaccountOrderHistory({
    marketId,
    subaccountId: subaccount.subaccountId,
    callback: ({ order }) => {
      if (!order) {
        return
      }

      switch (order.state) {
        case DerivativeOrderState.Booked:
        case DerivativeOrderState.Filled:
        case DerivativeOrderState.Unfilled:
        case DerivativeOrderState.PartialFilled: {
          const subaccountOrderHistory = [
            order,
            ...derivativeStore.subaccountOrderHistory.filter(
              (o) => order.orderHash !== o.orderHash
            )
          ]

          derivativeStore.$patch({
            subaccountOrderHistory,
            subaccountOrderHistoryCount: subaccountOrderHistory.length
          })

          break
        }
        case DerivativeOrderState.Canceled: {
          if (order.orderHash) {
            const subaccountOrderHistory =
              derivativeStore.subaccountOrderHistory.map((o) =>
                order.orderHash === o.orderHash ? order : o
              )

            derivativeStore.$patch({
              subaccountOrderHistory,
              subaccountOrderHistoryCount: subaccountOrderHistory.length
            })
          }

          break
        }
      }
    }
  })
}

export const streamSubaccountTrades = (marketId?: string) => {
  const derivativeStore = useDerivativeStore()
  const { subaccount } = useAccountStore()
  const { isUserWalletConnected } = useWalletStore()

  if (!isUserWalletConnected || !subaccount) {
    return
  }

  grpcStreamsSubaccountTrades({
    marketId,
    subaccountId: subaccount.subaccountId,
    callback: ({ trade, operation }) => {
      if (!trade) {
        return
      }

      switch (operation) {
        case StreamOperation.Insert: {
          const subaccountTrades = [trade, ...derivativeStore.subaccountTrades]

          derivativeStore.$patch({
            subaccountTrades,
            subaccountTradesCount: subaccountTrades.length
          })

          break
        }

        case StreamOperation.Delete:
          {
            const subaccountTrades = [
              ...derivativeStore.subaccountTrades
            ].filter((order) => order.orderHash !== trade.orderHash)

            derivativeStore.$patch({
              subaccountTrades,
              subaccountTradesCount: subaccountTrades.length
            })
          }
          break
        case StreamOperation.Update:
          if (trade.orderHash) {
            const subaccountTrades = [...derivativeStore.subaccountTrades].map(
              (order) => (order.orderHash === trade.orderHash ? trade : order)
            )

            derivativeStore.$patch({
              subaccountTrades,
              subaccountTradesCount: subaccountTrades.length
            })
          }

          break
      }
    }
  })
}

export const streamSubaccountOrders = (marketId?: string) => {
  const derivativeStore = useDerivativeStore()
  const { subaccount } = useAccountStore()
  const { isUserWalletConnected } = useWalletStore()

  if (!isUserWalletConnected || !subaccount) {
    return
  }

  grpcStreamsSubaccountOrders({
    marketId,
    subaccountId: subaccount.subaccountId,
    callback: ({ order }) => {
      if (!order) {
        return
      }

      const isConditional = [
        DerivativeOrderSide.TakeBuy,
        DerivativeOrderSide.TakeSell,
        DerivativeOrderSide.StopBuy,
        DerivativeOrderSide.StopSell
      ].includes(order.orderType as DerivativeOrderSide)

      switch (order.state) {
        case DerivativeOrderState.Booked:
        case DerivativeOrderState.Unfilled:
        case DerivativeOrderState.PartialFilled: {
          if (isConditional) {
            const subaccountConditionalOrders = [
              order,
              ...derivativeStore.subaccountConditionalOrders.filter(
                (o) => o.orderHash !== order.orderHash
              )
            ]

            derivativeStore.$patch({
              subaccountConditionalOrders,
              subaccountConditionalOrdersCount:
                subaccountConditionalOrders.length
            })
          } else {
            const subaccountOrders = [
              order,
              ...derivativeStore.subaccountOrders.filter(
                (o) => o.orderHash !== order.orderHash
              )
            ]

            derivativeStore.$patch({
              subaccountOrders,
              subaccountOrdersCount: subaccountOrders.length
            })
          }

          break
        }
        case DerivativeOrderState.Canceled:
        case DerivativeOrderState.Filled: {
          if (isConditional) {
            const subaccountConditionalOrders = [
              ...derivativeStore.subaccountConditionalOrders
            ].filter((o) => o.orderHash !== order.orderHash)

            derivativeStore.$patch({
              subaccountConditionalOrders,
              subaccountConditionalOrdersCount:
                subaccountConditionalOrders.length
            })
          } else {
            const subaccountOrders = [
              ...derivativeStore.subaccountOrders
            ].filter((o) => o.orderHash !== order.orderHash)

            derivativeStore.$patch({
              subaccountOrders,
              subaccountOrdersCount: subaccountOrders.length
            })
          }

          break
        }
      }
    }
  })
}

export const streamMarketMarkPrices = (market: UiDerivativeMarketWithToken) => {
  const derivativeStore = useDerivativeStore()

  if (market.subType === MarketType.BinaryOptions) {
    return
  }

  grpcStreamsMarketMarkPrice({
    market,
    callback: ({ price, operation }) => {
      if (!price) {
        return
      }

      switch (operation) {
        case StreamOperation.Update:
          derivativeStore.$patch({ marketMarkPrice: price })
      }
    }
  })
}

export const cancelSubaccountTradesStream = () =>
  grpcCancelSubaccountTradesStream()
