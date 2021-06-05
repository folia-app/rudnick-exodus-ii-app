import debounce from 'lodash/debounce'
import { exception } from 'vue-gtag'
const deployBlock = 0 // process.env.NODE_ENV === 'development' ? 0 : 12088025
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
        // !! contract missing
        if (!getters.contract) {
          console.warn('contract not set')
          return null // default/loading state in component
        }
        // fetch...
        auction = await getters.contract.methods.auctions(token).call()

        // format + save
        if (auction && auction.exists) {
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
        const auction = await dispatch('get', { token, flush: true })
        const globalPaused = await dispatch('getGlobalPaused')
        const web3 = await dispatch('getWeb3', null, { root: true })
        const bn = mixed => new web3.utils.BN(mixed)

        // !! all auctions paused
        if (globalPaused) throw new Error('!! Auctions are currently locked. Please wait for release or try again shortly.')

        // !! auction doesn't exist
        if (!auction || !auction.exists) throw new Error(`!! Auction for ${token} doesn't exist.`)

        // !! paused
        if (auction.paused) throw new Error(`!! Auction for ${token} is locked. Please wait for release or try again shortly.`)

        // !! auction not released yet
        const isReleased = auction.firstBidTime === '0' || new Date().getTime() >= new Date(Number(auction.firstBidTime) * 1000)
        if (!isReleased) throw new Error(`!! Auction for ${token} is not yet released.`)

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
        if (!rootState.address) {
          await dispatch('connect', null, { root: true })
        }

        // !! not enough ETH
        const balance = await rootGetters.userBalance()
        const insufficientFunds = bn(balance).lt(bn(wei))
        if (insufficientFunds) throw new Error('!! Insufficient funds in your wallet')

        // !! low time confirmation
        const hasStarted = Number(auction.firstBidTime)
        const endingSoon = getters.auctionEndTimeMs({ auction }) - new Date().getTime() <= state.lowTimeMin * 60 * 1000
        if (hasStarted && endingSoon) {
          if (!window.confirm('This auction is ending very soon! There is a high chance your bid will result in an error. Continue?')) {
            throw new Error('User cancelled bid because low time')
          }
        }

        // bid !
        const bid = await getters.contract.methods
          .createBid(token)
          .send({ from: rootState.address, value: wei })

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

    async endAuction ({ getters, dispatch, rootState }, { token }) {
      try {
        // go!
        await getters.contract.methods
          .endAuction(token)
          .send({ from: rootState.address })

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
          const events = await getters.contract.getPastEvents('AuctionBid', { fromBlock: deployBlock })
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
          const events = await getters.contract.getPastEvents('AuctionEnded', { fromBlock: deployBlock })
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
