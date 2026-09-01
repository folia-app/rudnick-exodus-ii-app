/**
 * One event stream fed by several websockets at once.
 *
 * A single websocket is a single point of failure in a way an http call is not:
 * there is no retry on a subscription that quietly stops delivering. It does not
 * error, it just goes silent, and a missed event here is a missed bid.
 *
 * So rather than pick one endpoint and hope, this subscribes on all of them
 * simultaneously and passes the first copy of each log through. Duplicates are
 * dropped by blockHash + logIndex, which identifies a log uniquely — the same
 * event arriving from three providers is one event.
 *
 * Measured against a busy contract: three endpoints each delivered the same 69
 * logs over 35 seconds, and dedup emitted 69.
 *
 * The dedup set is bounded; without that it grows for as long as the page is
 * open. Evicting oldest-first is safe because duplicates arrive within seconds
 * of each other, never thousands of logs apart.
 */
// Verified 2026-09-01: all three deliver log subscriptions. Endpoints that
// accept a websocket connection but never deliver logs — merkle, mevblocker,
// blastapi, callstaticrpc, blockrazor — are deliberately absent.
export const WSS_MAINNET = [
  'wss://ethereum-rpc.publicnode.com',
  'wss://mainnet.gateway.tenderly.co',
  'wss://eth.drpc.org'
]

export function subscribeDeduped ({ Web3, urls, abi, address, eventName, onData, onError, cap = 5000 }) {
  const seen = new Set()
  const order = []
  const sockets = []

  const remember = (k) => {
    seen.add(k)
    order.push(k)
    if (order.length > cap) seen.delete(order.shift())
  }

  urls.forEach((url) => {
    try {
      const web3 = new Web3(new Web3.providers.WebsocketProvider(url, {
        reconnect: { auto: true, delay: 2000, maxAttempts: Infinity }
      }))
      const contract = new web3.eth.Contract(abi, address)
      const sub = contract.events[eventName]()
        .on('data', (event) => {
          const key = `${event.blockHash}:${event.logIndex}`
          if (seen.has(key)) return
          remember(key)
          try { onData(event) } catch (e) { onError && onError(e, url) }
        })
        // One endpoint failing is expected and not worth surfacing to the user;
        // the others carry the stream. Only report it for diagnostics.
        .on('error', (err) => onError && onError(err, url))
      sockets.push({ url, web3, sub })
    } catch (err) {
      onError && onError(err, url)
    }
  })

  return function unsubscribe () {
    sockets.forEach(({ web3, sub }) => {
      try { sub.unsubscribe() } catch (e) { /* already gone */ }
      try { web3.currentProvider && web3.currentProvider.disconnect() } catch (e) { /* already gone */ }
    })
  }
}
