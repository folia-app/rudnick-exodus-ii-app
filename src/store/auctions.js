import debounce from 'lodash/debounce'
import { exception } from 'vue-gtag'
import Web3 from 'web3'

// The auction contract's deploy block. This was 0 -- a scan from genesis --
// with the real value sitting commented out beside it, presumably left over
// from local work against a fresh chain.
const deployBlock = 12088025

// Log scans need an endpoint that will serve a wide block range, and the
// websocket the rest of the app runs on will not. Asked for this contract's
// logs from the deploy block, the free endpoints answer:
//
//   ethereum-rpc.publicnode.com  "Archive requests require a personal token"
//   eth.drpc.org                 "ranges over 10000 blocks are not supported
//                                 on free plan"
//   gateway.tenderly.co          202 logs
//
// The rejection is a json-rpc error rather than a truncated result, so
// getPastBids and getAuctionsEnded threw outright and the auction history was
// simply absent. Chunking to stay under the caps would mean ~300 sequential
// requests on page load, and publicnode refuses the historical range at any
// width, so the scans get their own http provider instead. Everything else --
// calls, subscriptions, transactions -- still goes over the websocket.
const LOG_RPC = import.meta.env.VITE_LOG_RPC || 'https://gateway.tenderly.co/public/mainnet'

let logWeb3 = null
let logTwin = null

// A read-only twin of the live contract, on the log-capable endpoint. Built
// from the contract already in the store rather than a second import, so the
// abi and address cannot drift apart from the one the app is using.
function forLogs (contract) {
  if (!logWeb3) logWeb3 = new Web3(new Web3.providers.HttpProvider(LOG_RPC))
  if (!logTwin || logTwin.options.address !== contract.options.address) {
    logTwin = new logWeb3.eth.Contract(contract.options.jsonInterface, contract.options.address)
  }
  return logTwin
}

const BigInt = window.BigInt

export default {
  namespaced: true,
  state: {
    auctions: [],
    minBidWei: 0, // 1 * 10 ** 17, // 0.1 ETH - refer to contract
    bidStepETH: 0.1, // TODO - CONFIRM
    lowTimeMin: 2
  },

  getters: {
    contract (state, getters, rootState) {
      return rootState.reserveAuctionContract
    },
    auctionStarted: (state) => ({ tokenId, auction }) => {
      auction = auction || state.auctions.find(auc => auc._tokenId === tokenId)
      return auction && Number(auction.firstBidTime) > 0
    },
    auctionEnded: (state, getters) => ({ tokenId, auction }) => {
      auction = auction || state.auctions.find(auc => auc._tokenId === tokenId)
      // ended ?
      if (auction?.winner) return true
      // !! no auction or hasn't started
      if (!auction || !Number(auction.firstBidTime)) {
        return false
      }
      // compare to now
      const timeMs = getters.auctionEndTimeMs({ auction })
      return timeMs && timeMs < new Date().getTime()
    },
    auctionEndTimeMs: (state) => ({ tokenId, auction }) => {
      auction = auction || state.auctions.find(auc => auc._tokenId === tokenId)
      let time
      if (auction) {
        time = Number(auction.firstBidTime) + Number(auction.duration) // seconds
        time = time * 1000 // milliseconds (for counters)
      }
      return time
    }
  },

  mutations: {
    SAVE_AUCTION (state, auction) {
      // remove old if updating existing
      const i = state.auctions.findIndex(auc => auc._tokenId === auction._tokenId)
      if (i > -1) {
        state.auctions.splice(i, 1) // remove
      }
      // add active acutions to the front for prioritized look-up
      state.auctions.unshift(auction)
    },

    SAVE_AUCTIONS_ENDED (state, auctions) {
      // add ended auctions to end
      state.auctions = state.auctions.concat(auctions)
    }
  },

  actions: {
    async get ({ state, getters, commit, dispatch }, { token }) {
      try {
        let auction
        // saved ?
        // let auction = state.auctions.find(auc => auc._tokenId === token)
        // // auction ended? use saved
        // if (getters.auctionEnded({ auction })) {
        //   return auction
        // }
        // ...fetch
        // wait for init
        if (!getters.contract) {
          await dispatch('init', null, { root: true })
        }
        // fetch...
        auction = await getters.contract.methods.auctions(token).call()

        // format + save
        if (auction?.exists) {
          // format
          auction = { _tokenId: token, ...auction }
          // save
          commit('SAVE_AUCTION', auction)
        }

        // maybe ended ?
        if (auction && !auction.exists) {
          const ended = await dispatch('getAuctionsEnded')
          auction = ended.find(auc => auc._tokenId === token.toString())
        }

        return auction
      } catch (e) {
        console.error('@getAuction', e)

        // MetaMask / Infura bonked - https://github.com/MetaMask/metamask-extension/issues/7234
        // if (e.code === -32000 && e.message === 'header not found') {
        //   // state.retryCalls.push({ token, code: e.code })
        //   console.log('retrying in 500ms...')
        //   await new Promise((res) => setTimeout(() => (res), 500)) // wait 500ms
        //   return dispatch('get', { token })
        // }
      }
    },

    async bid ({ state, getters, dispatch, rootState, rootGetters }, { token, wei }) {
      try {
        const address = rootGetters.address
        const auction = await dispatch('get', { token, flush: true })
        const globalPaused = await dispatch('getGlobalPaused')
        const web3 = await dispatch('getWeb3', null, { root: true })
        const bn = mixed => new web3.utils.BN(mixed)
        const skipChecks = new URL(window.location.href).searchParams.get('skip')

        if (!skipChecks) {
          // !! all auctions paused
          if (globalPaused) throw new Error('!! Auctions are currently locked. Please wait for release or try again shortly.')
  
          // !! auction doesn't exist
          if (!auction || !auction.exists) throw new Error(`!! Auction for ${token} doesn't exist.`)
  
          // !! paused
          if (auction.paused) throw new Error(`!! Auction ${token} is locked. Please wait for release or try again shortly.`)
  
          // !! auction not released yet
          const isReleased = auction.firstBidTime === '0' || new Date().getTime() >= new Date(Number(auction.firstBidTime) * 1000)
          if (!isReleased) throw new Error(`!! Auction ${token} is not yet released.`)
  
          // !! auction expired
          if (getters.auctionEnded({ auction })) throw new Error('!! Auction has ended!')
  
          // !! less than reserve price
          const belowReserve = bn(wei).lt(bn(auction.reservePrice))
          if (belowReserve) throw new Error('!! Your bid is below the reserve price. Please increase your bid.')
  
          // !! bid below minimum amount (only applies once a bid of value is in place)
          if (BigInt(auction.amount)) {
            const minBidWei = BigInt(auction.amount) + BigInt(rootGetters.ethToWei(state.bidStepETH.toString()))
            const isBelowMin = BigInt(wei) < minBidWei
            const minBidETH = rootGetters.weiToETH(minBidWei.toString())
            if (isBelowMin) throw new Error(`!! Minimum bid is ${minBidETH} ETH. Please increase your bid.`)
          }
  
          // connected wallet ?
          if (!address) {
            // await dispatch('connect', null, { root: true })
            throw new Error('!! Connect your wallet first!')
          }
  
          // !! not enough ETH
          const balance = await rootGetters.userBalance()
          const insufficientFunds = bn(balance).lt(bn(wei))
          if (insufficientFunds) throw new Error('!! Your wallet balance is below that bid.')
  
          // !! low time confirmation
          const hasStarted = Number(auction.firstBidTime)
          const endingSoon = getters.auctionEndTimeMs({ auction }) - new Date().getTime() <= state.lowTimeMin * 60 * 1000
          if (hasStarted && endingSoon) {
            if (!window.confirm('This auction is ending very soon! There is a chance your bid will result in an error. Continue?')) {
              throw new Error('User cancelled bid because low time')
            }
          }
        }

        // bid !
        const bid = await getters.contract.methods
          .createBid(token)
          .send({ from: address, value: wei })

        // refresh auction
        // dispatch('get', { token, flush: true })

        return bid

      // errors...
      } catch (e) {
        console.error('@bid:', e)
        // track
        exception({ description: `@bid: ${e.message}`, fatal: false })
        // TODO - more elegant UX error ?
        if (e.message?.includes('!! ')) {
          alert(e.message.replace('!! ', ''))
        }
        return false
      }
    },

    async endAuction ({ getters, dispatch, rootGetters }, { token }) {
      try {
        // go!
        await getters.contract.methods
          .endAuction(token)
          .send({ from: rootGetters.address })

        // refresh auction
        await dispatch('get', { token, flush: true })
      } catch (e) {
        console.error('@endAuction:', e)
        // track
        exception({ description: `@endAuction: ${e.message}`, fatal: false })
        // TODO - more elegant UX error ?
        if (e.message?.includes('!! ')) {
          alert(e.message.replace('!! ', ''))
        }
      }
    },

    async getGlobalPaused ({ getters }) {
      let paused
      try {
        if (getters.contract) {
          paused = await getters.contract.methods.globalPaused().call()
        }
      } catch (e) {
        console.error(e)
      }
      return paused
    },

    // getPastBids: debounce(async function ({ getters, commit }, { token = 0 }) {
    async getPastBids ({ getters, commit }, { token = 0 }) {
      try {
        let bids = []
        if (getters.contract) {
          const events = await forLogs(getters.contract).getPastEvents('AuctionBid', { fromBlock: deployBlock })
          // format
          bids = events.map(({ returnValues }) => returnValues)
          // commit('SAVE_PAST_BIDS', bids)
        }
        return bids.filter(bid => bid.tokenId === token.toString()).reverse()
      } catch (e) {
        console.error(e)
      }
    }, // , 5000, { leading: true, trailing: false }),

    getAuctionsEnded: debounce(async function ({ getters, commit }) {
      try {
        let auctions = []
        if (getters.contract) {
          const events = await forLogs(getters.contract).getPastEvents('AuctionEnded', { fromBlock: deployBlock })
          // format
          auctions = events.map(({ returnValues }) => ({ _tokenId: returnValues.tokenId, ...returnValues }))
          commit('SAVE_AUCTIONS_ENDED', auctions)
        }
        return auctions
      } catch (e) {
        console.error(e)
      }
    }, 5000, { leading: true, trailing: false })
  }
}

// HELPERS
