import Vue from 'vue'
import Vuex from 'vuex'
// import ReserveAuction from 'folia-contracts/build/contracts/ReserveAuction.json'
import ReserveAuction from '../../contracts/ReserveAuction.json'
import Web3 from 'web3'
// import { exception } from 'vue-gtag'
// modules
import auctions from './auctions'
import onboard from '../plugins/web3onboard/onboard'
import networksData from '../networks'
import { providers } from 'ethers'

const appNetwork = import.meta.env.VITE_NETWORK_NAME

// Free, keyless websocket endpoints. This has to stay a websocket: Auction.vue
// subscribes to live auction events with .on('data'), which an http provider
// cannot serve.
//
// web3's WebsocketProvider takes one url and does not fail over between
// endpoints, so this is a single address rather than a pool. The alternate below
// is verified working and can be swapped in via VITE_WSS_MAINNET without a code
// change — which is the practical form redundancy takes here.
//
//   wss://ethereum-rpc.publicnode.com   (default)
//   wss://eth.drpc.org                  (alternate)
const WSS_MAINNET = import.meta.env.VITE_WSS_MAINNET || 'wss://ethereum-rpc.publicnode.com'

const networks = {
  mainnet: { id: 1, rpc: WSS_MAINNET },
  rinkeby: { id: 4, rpc: WSS_MAINNET }
}

let walletProvider
const rpcProvider = new Web3(new Web3.providers.WebsocketProvider(networks[appNetwork].rpc))
// TODO use browser provider if on correct network...
// let browserProvider = window.ethereum || Web3.currentProvider || Web3.givenProvider
// browserProvider = browserProvider && new Web3(browserProvider)
// const fallbackProvider = browserProvider || rpcProvider

let web3 = rpcProvider

// web3onboard.js (connect wallet modal)
// this subscribes to the onboard.js state object and updates the vuex store anytime it changes
// this includes connecting, disconnecting or changing balance
// when connected to the correct network, it updates the contracts to be executable
// when connected to the wrong network or no network, it updates the contracts to be read-only
const state = onboard.state.select()
state.subscribe((update) => {
  console.log('state update: ', update)

  const account = (update.wallets?.length && update.wallets[0]?.accounts[0]) ?? {}
  store.commit('ACCOUNT', { account })

  const wallet = update.wallets[0] ?? {}
  store.commit('WALLET', { wallet })

  const rightNetwork = wallet?.provider?.chainId === networksData[appNetwork].id
    || wallet?.provider?.chainId === networksData[appNetwork].hex
    || wallet?.provider?.chains.find(chain => chain.id === networksData[appNetwork].id || chain.id === networksData[appNetwork].hex)
  
  if (wallet?.provider && rightNetwork) {
    walletProvider = wallet.provider
    web3 = new Web3(walletProvider)
  } else {
    web3 = rpcProvider
  }
  // update contracts
  store.commit('SET_CONTRACTS', { web3 })
})

// load saved ensNames
let ensNames = {}
try {
  ensNames = JSON.parse(sessionStorage.getItem('ensNames')) || {}
  if (ensNames.length !== undefined) throw new Error('malformed ensNames')
} catch (_) {
  sessionStorage.removeItem('ensNames')
  ensNames = {}
}

Vue.use(Vuex)

const store = new Vuex.Store({
  modules: { auctions },
  state: {
    wallet: {},
    account: {},

    networkId: networks[appNetwork].id,

    reserveAuctionContract: null,

    works: [],
    tokens: [],
    metadatas: [],
    names: {},
    debug: new URL(window.location.href).searchParams.get('debug'),
    ensNames,
  },
  getters: {
    address: (state) => state.account?.address ?? null,
    weiToETH: () => (wei) => web3?.utils.fromWei(wei) ?? '-',
    ethToWei: () => (eth) => web3?.utils.toWei(eth) ?? '-',
    workId: () => (uid, prefix) => {
      const id = Number(uid) // / 1000000
      return prefix ? ('00' + id).slice(-3) // 001
        : id // 1 - for contract communication
    },
    addrShort: () => (addr) => addr ? '0x' + addr.slice(2, 6).toUpperCase() + '...' + addr.slice(-4).toUpperCase() : '...',
    userBalance: (state, getters) => (addr) => web3?.eth.getBalance(addr || getters.address) || 0, // wei
    contractAddr: (state) => state.foliaContract?._address,
    isSoldOut: () => (work) => {
      return work && Number(work.editions) && Number(work.printed) >= Number(work.editions)
    },
    openSeaLink: (state, getters) => ({ token, account }) => {
      const isTestnet = [4].includes(state.networkId)
      const path = token ? `/assets/${getters.contractAddr}/${token}`
        : account ? `/accounts/${account}`
          : ''
      return `https://${isTestnet ? 'testnets.' : ''}opensea.io` + path
    },
    meta: state => ({ title, descrip, img }) => {
      const meta = []
      // defaults
      const siteTitle = 'Folia'
      const siteDescrip = 'A space for collecting and exhibiting NFTs'
      const siteImg = 'https://www.folia.app/folia-logo-twitter-black.png'
      // custom
      title = title ? `${siteTitle} - ${title}` : siteTitle
      descrip = descrip || siteDescrip
      img = img || siteImg
      // add
      meta.push({ property: 'og:title', content: title })
      meta.push({ property: 'og:site_name', content: siteTitle })
      meta.push({ property: 'og:type', content: 'website' })
      meta.push({ name: 'description', content: descrip })
      meta.push({ property: 'og:description', content: descrip })
      meta.push({ property: 'og:image', content: img })
      // twitter?
      meta.push({ name: 'twitter:card', content: 'summary_large_image' })
      meta.push({ name: 'twitter:domain', content: 'folia.app' })
      // meta.push({ property: 'og:url', content: ##ADDCANNONICAL## })
      return meta
    }
  },
  mutations: {
    WALLET (state, { wallet }) {
      state.wallet = wallet
    },
    ACCOUNT (state, { account }) {
      state.account = account
    },
    SIGN_IN (state, address) {
      state.address = address
    },
    SIGN_OUT (state) {
      state.address = null
    },
    // SET_NETWORK (state, id) {
    //   state.networkId = id
    // },
    SAVE_WORK (state, work) {
      const i = state.works.findIndex(svd => svd.id === work.id)
      // remove existing ?
      if (i > -1) state.works.splice(i, 1)
      // push so app updates
      state.works.push(work)
    },
    SAVE_TOKEN (state, token) {
      state.tokens.push(token) // [tokenId, ownerAddr]
    },
    SAVE_METADATA (state, metadata) {
      state.metadatas.push(metadata)
    },
    SET_CONTRACTS (state, { web3 }) {
      if (!web3) throw new Error('web3 not defined')
      // auctions
      if (ReserveAuction.networks[state.networkId]) {
        state.reserveAuctionContract = new web3.eth.Contract(
          ReserveAuction.abi,
          ReserveAuction.networks[state.networkId].address
        )
        console.log('auction addr', ReserveAuction.networks[state.networkId].address)
      }
    },
    SAVE_NAME (state, { address, name }) {
      const names = { ...state.names }
      names[address] = name
      state.names = names
    },
    ADD_ENS_NAME(state, { addr, result }) {
      ensNames[addr.toLowerCase()] = result
      // save to session storage for future lookup
      sessionStorage.setItem('ensNames', JSON.stringify(state.ensNames))
      state.ensNames = JSON.parse(JSON.stringify(ensNames))
    },
  },
  actions: {
    /* setup web3, contracts */
    // async init ({ state, commit, dispatch }) {
    //   // de-dupe
    //   if (initializing) {
    //     return initializing
    //   }

    //   const setup = async () => {
    //     try {
    //       // auto-connect?
    //       if (web3Modal.cachedProvider) {
    //         await dispatch('connect')
    //       }

    //       // setup web3
    //       if (!web3) {
    //         if (provider) {
    //           web3 = new Web3(provider)
    //         } else {
    //           // fallback to infura
    //           // const n = process.env.NODE_ENV === 'development' ? 'rinkeby' : 'mainnet'
    //           const n = 'mainnet'
    //           web3 = new Web3(new Web3.providers.WebsocketProvider(networks[n].infura))
    //         }
    //       }

    //       // setup contracts
    //       const networkId = state.networkId || await web3.eth.net.getId() || networks.mainnet.id
    //       console.log('network:', networkId)
    //       commit('SET_NETWORK', networkId)
    //       commit('SET_CONTRACTS', { web3, networkId })

    //       // listen to provider events
    //       dispatch('listenToProvider')
    //       initializing = null
    //     } catch (e) {
    //       console.error('@init', e)
    //     }
    //   }
    init ({ state, commit }) {
      if (state.reserveAuctionContract) return
      commit('SET_CONTRACTS', { web3 })
      return
    },

    //   // create a promise for the handler
    //   initializing = new Promise((resolve, reject) => setup().then(resolve).catch(reject))

    //   return initializing
    // },

    getWeb3 () {
      // TODO better handler for this
      return web3
    },

    /* connect wallet */
    // async connect ({ commit, dispatch }) {
    //   try {
    //     // connect and update provider, web3
    //     provider = await web3Modal.connect()
    //     web3 = new Web3(provider)
    //     // save account
    //     const accounts = await web3.eth.getAccounts()
    //     const address = accounts[0]
    //     const networkId = await web3.eth.net.getId()
    //     // const chainId = await web3.eth.chainId(); // not a function??
    //     commit('SIGN_IN', address)
    //     commit('SET_NETWORK', networkId)
    //   } catch (e) {
    //     console.error('@connect', e)
    //     // clear in case
    //     web3Modal.clearCachedProvider()
    //   }
    // },
    async connect ({ commit, dispatch }) {
      return onboard.connectWallet()
    },

    /* disconnect wallet */
    // disconnect ({ commit }) {
    //   // clear so they can re-select from scratch
    //   web3Modal.clearCachedProvider()

    //   // manually clear walletconnect --- https://github.com/Web3Modal/web3modal/issues/354
    //   localStorage.removeItem('walletconnect')

    //   // provider.off('accountsChanged')
    //   // provider.off('disconnect')
    //   commit('SIGN_OUT')
    // },
    async disconnect ({ state, commit, dispatch }) {
      if (!state.wallet.label) return
      // disconnect the first wallet in the wallets array
      await onboard.disconnectWallet({ label: state.wallet.label })
    },

    /* wallet events */
    // listenToProvider ({ commit, dispatch }) {
    //   if (!provider?.on) return

    //   // account changed (or disconnected)
    //   provider.on('accountsChanged', accounts => {
    //     console.log('accountsChanged', accounts)
    //     if (!accounts.length) {
    //       return dispatch('disconnect')
    //     }
    //     commit('SIGN_IN', accounts[0])
    //   })

    //   // changed network
    //   provider.on('chainChanged', chainId => {
    //     console.log('network changed', chainId)
    //     // reload page so data is correct...
    //     window.location.reload()
    //   })

    //   // random disconnection? (doesn't fire on account disconnect)
    //   provider.on('disconnect', error => {
    //     console.error('disconnected?', error)
    //     dispatch('disconnect')
    //   })
    // },

    async getAddressOpenSeaName ({ state, commit, dispatch }, address) {
      try {
        address = address.toLowerCase()
        // saved?
        if (state.names[address]) return state.names[address]
        // get!
        const prefix = state.networkId === 4 ? 'testnets-' : ''
        let resp = await fetch(`https://${prefix}api.opensea.io/api/v1/account/${address}`)

        // throttled ?
        if (resp.status === 429) {
          setTimeout(() => {
            return dispatch('getAddressOpenSeaName', address)
          }, 1000)
        }

        resp = await resp.json()

        const name = resp.data?.user?.username

        if (name) {
          commit('SAVE_NAME', { address, name })
        }

        return name
      } catch (e) {
        // console.error('@getAddressOpenSeaName', e)
        return false
      }
    },

    /* buy artwork */
    // async buy ({ state, dispatch }, workId) {
    //   try {
    //     const work = await dispatch('getWork', { id: workId, flush: true })
    //     // !! unavailable
    //     if (!work.exists) throw new Error(`!! Work ${workId} doesn't exist`)
    //     if (Number(work.printed) >= Number(work.editions)) throw new Error(`!! Work ${workId} is sold out`)
    //     if (work.paused) throw new Error(`!! Work ${workId} is locked. Please wait for release or try again shortly.`)
    //     // wallet connected ?
    //     if (!state.address) {
    //       await dispatch('connect')
    //     }
    //     // buy
    //     await state.foliaControllerContract.methods
    //       .buy(state.address, workId)
    //       .send({ from: state.address, value: work.price })
    //     // refresh work data for app
    //     dispatch('getWork', { id: workId, flush: true })
    //   } catch (e) {
    //     console.error('@buy:', e)
    //     // track
    //     exception({ description: `@buy: ${e.message}`, fatal: false })
    //     // TODO - more elegant UX error ?
    //     if (e.message?.includes('!! ')) {
    //       alert(e.message.replace('!! ', ''))
    //     }
    //   }
    // },

    // /* buy by ID */
    // async buyByID ({ state, dispatch, rootGetters }, { tokenId }) {
    //   try {
    //     const workId = Math.floor(tokenId / 1000000)
    //     const workSpace = workId * 1000000
    //     const editionId = tokenId - workSpace
    //     const bn = mixed => new web3.utils.BN(mixed)

    //     const work = await dispatch('getWork', { id: workId, flush: true })
    //     // !! unavailable
    //     if (!work.exists) throw new Error(`!! Work ${workId} doesn't exist`)
    //     // !! paused
    //     if (work.paused) throw new Error(`!! Work ${workId} is locked. Please wait for release or try again shortly.`)

    //     // wallet connected ?
    //     if (!state.address) {
    //       await dispatch('connect')
    //     }

    //     // !! not enough ETH
    //     const balance = await rootGetters.userBalance()
    //     const insufficientFunds = bn(balance).lt(bn(work.price))
    //     if (insufficientFunds) throw new Error(`!! Insufficient funds in your wallet\n${state.address}`)

    //     // buy
    //     await state.foliaControllerContract.methods
    //       .buyByID(state.address, workId, editionId)
    //       .send({ from: state.address, value: work.price })
    //     // refresh work data for app
    //     dispatch('getWork', { id: workId, flush: true })
    //   } catch (e) {
    //     console.error('@buyByID:', e)
    //     // track
    //     exception({ description: `@buyByID: ${e.message}`, fatal: false })
    //     // TODO - more elegant UX error ?
    //     if (e.message?.includes('!! ')) {
    //       alert(e.message.replace('!! ', ''))
    //     }
    //   }
    // },

    //  read artwork
    // async getWork ({ state, commit }, { id, flush }) {
    //   let work = state.works.find(work => work.id === id)
    //   if (!flush && work) return work

    //   if (!state.foliaControllerContract) {
    //     console.warn('controller not set yet')
    //     return
    //   }
    //   // get new data
    //   if (id && !isNaN(id)) {
    //     try {
    //       work = await state.foliaControllerContract.methods.works(id).call()
    //       work = { id, ...work } // add id
    //       commit('SAVE_WORK', work)
    //     } catch (e) {
    //       console.error('@getWork', e)
    //     }
    //   }
    //   return work
    // },

    // /* get metadata of work (if released) */
    // async getMetadata ({ state, commit }, { token, work, isViewer = false }) {
    //   try {
    //     token = token || Number(work) * 1000000
    //     work = work || Math.floor(Number(token) / 1000000)

    //     // !! is not a number
    //     if (isNaN(token)) throw new Error(`Token ID is not a number: ${token}`)

    //     // return saved ?
    //     const saved = state.metadatas.find(metadata => metadata._token === token)
    //     const now = new Date().getTime()
    //     const release = saved && saved.release && new Date(saved.release).getTime()
    //     const hasSinceReleased = release && release > 0 && now >= release
    //     if (saved && !hasSinceReleased) {
    //       return saved
    //     }
    //     // fetch new
    //     // query parameters
    //     let params = []
    //     if (state.networkId) params.push(`network=${state.networkId}`)
    //     if (isViewer) params.push('viewer=1')
    //     params = params.length ? '?' + params.join('&') : ''
    //     const url = `/.netlify/functions/metadata/${token}${params}`
    //     // go!
    //     let metadata = await fetch(url).then(resp => resp.json())
    //     // process
    //     if (metadata && metadata.name) {
    //       metadata = { _work: work, _token: token, ...metadata }
    //       commit('SAVE_METADATA', metadata)
    //       return metadata
    //     }
    //     return null
    //   } catch (e) {
    //     console.error(e)
    //   }
    // },

    // /* get owner by token id */
    // async getNFTOwnerByTokenId ({ state, commit }, tokenId) {
    //   try {
    //     const token = state.tokens.find(token => token[0] === tokenId) || []
    //     let owner = token && token[1]
    //     if (owner) return owner
    //     // get new data
    //     if (state.foliaContract) {
    //       owner = await state.foliaContract.methods.ownerOf(tokenId).call()
    //       commit('SAVE_TOKEN', [tokenId, owner])
    //       return owner
    //     }
    //     return null
    //   } catch (e) {
    //     // seems to error if token doesn't exist...
    //     console.error("get owner error / token doesn't exist?", tokenId, e)
    //     return 0
    //   }
    // }
    async ensName({ state, commit }, addr) {
      addr = addr.toLowerCase()

      if (state.ensNames[addr] !== undefined) {
        return state.ensNames[addr]
      }

      try {
        const mainnetProvider = await getProvider({ name: 'homestead' })
        const result = await mainnetProvider.lookupAddress(addr)
        commit('ADD_ENS_NAME', { addr, result }) // save even null
        return result
      } catch (_) { }
    },
  }
})

// helper
async function getProvider({ name = 'homestead' }) {
  // Keyless http endpoint rather than a keyed provider.
  const readProvider = new providers.JsonRpcProvider(
    import.meta.env.VITE_RPC_MAINNET || 'https://gateway.tenderly.co/public/mainnet'
  )
  let provider = readProvider

  // swap-in window provider if on correct network
  if (window.ethereum) {
    const windowProvider = new providers.Web3Provider(window.ethereum)

    try {
      const network = await windowProvider.getNetwork()
      if (network.name === name) {
        provider = windowProvider
      }
    } catch (e) {
      // console.error(e)
    }
  }
  return provider
}

export default store
