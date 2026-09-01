<template lang="pug">
.auction(v-if="auction")
  //- countdown clock
  .flex.w-full.justify-center(v-if="auction && !auction.winner")
    <countdown :end="auctionEndMs" @ended="onTimerEnded" key="1" :values="`${debug ? 'd,' : ''}h,m,s,ms`"></countdown>

  //- (completed / winner)
  .mt-20.text-base.font-medium(v-if="auction.winner")
    button.p-15.-my-15.leading-none(@click="bidsVisible = !bidsVisible", style="font-size:1.25em") +
    <br>
    a.inline-block.mt-18.lg_hover_text-white.leading-none(:href="openSeaLink({account: auction.winner})", target="_blank", rel="noopener noreferrer", v-show="bidsVisible")
      username(:address="auction.winner", :short="false")

  //- (bidding UI)
  form.mt-35.mb-50.flex.justify-center.w-full(@submit.prevent="bid", v-if="auctionEnded !== true || (debug && !auction.winner)")
    .flex.items-center.group.px-20
      //- bid
      .mx-20.leading-flat.relative
        label.sr-only Enter a bid:
        input.text-md.md_text-lg.block.text-center.focus_outline-none(ref="input", type="number", v-model="bidETH", :min="minBidETH", step="any", required, :style="{minWidth: '1.25em', width: inputWidth}", inputmode="decimal", :placeholder="placeholder")
        small.block.absolute.w-full.mt-2.md_mt-5.pt-8.left-0.text-sm.text-white.font-medium ETH
      //- bid btn
      btn.mx-10.lg_mb-7.px-20(type="submit") BID

  //- claim btn
  btn.mt-35.-mb-10.mx-auto.px-15(v-if="auctionEnded && !auction.winner && sameAddr(address, auction.bidder)", @click.native="endAuction") CLAIM

  //- bid lists
  .mt-40.w-full.flex.justify-center.font-medium.text-base(v-if="auction && (!auction.winner || bidsVisible)")
    .w-full.lg_w-2x3.px-15.mx-auto.w-auto
      //- my bids
      ul.mb-20.text-gray-500.flex.flex-col-reverse(v-if="myBids.length")
        li.w-full.flex.justify-between.group(v-for="bid in myBids")
          //- time
          div.md_min-w-1x5.text-left.whitespace-no-wrap.flex-shrink-0 {{ bidTime(bid.time) }}
          //- status
          .min-w-0.flex-auto.mx-12.text-left.md_text-center {{ bid.status === 2 ? 'ERROR/CANCELLED' : 'BIDDING...' }}
          //- amount / delete
          div.md_min-w-1x5.text-right.whitespace-no-wrap.flex-shrink-0
            div.group-hover_hidden {{ bid.amount }}
            button.hidden.group-hover_inline.text-white(@click="removeMyBid(bid.time)") HIDE

      //- all bids list
      ul.text-gray-500
        li.w-full.flex.justify-between.hover_text-white(v-for="(bid, i) in bids", :key="bid.value", :class="{'text-white': sameAddr(auction.bidder, bid.sender) && auction.amount === bid.value && i === 0}")
          //- time
          div.md_min-w-1x5.text-left.whitespace-no-wrap.flex-shrink-0 {{ bidTime(bid.timestamp) }}
          //- bidder
          .min-w-0.flex-auto.mx-12.text-left.md_text-center
            div.truncate
              a(:href="openSeaLink({account: bid.sender})", target="_blank", rel="noopener noreferrer")
                template(v-if="sameAddr(address, bid.sender)") YOU
                username(v-else, :address="bid.sender", :short="false", :key="address")
          //- amount
          div.md_min-w-1x5.text-right.whitespace-no-wrap.flex-shrink-0 {{ weiToETH(bid.value) }}
        //- li.w-full.flex.justify-between(v-for="n in 12")
          .min-w-0.flex-auto.text-left
            div.truncate
              a(href="http://etherscan.io/address/0xaF2CE0962D1a4B1AAB10f7faA62bBbcA40a8EA53", target="_blank")
                | 0x{{'aF2CE0962D1a4B1AAB10f7faA62bBbcA40a8EA53'.toUpperCase()}}
          div.ml-30 {{ (n - 1) / 10 }}
</template>

<script>
import Web3 from 'web3'
import { subscribeDeduped, WSS_MAINNET } from '../plugins/multiSocket'
import { mapState, mapGetters } from 'vuex'
import Countdown from './Countdown.vue'
import Btn from './Btn.vue'
import Username from './Username.vue'
export default {
  name: 'Auction',
  props: ['releaseMs', 'tokenId', 'auctionInit'],
  components: { Countdown, Btn, Username },
  data () {
    return {
      auction: {},
      bidETH: '',
      myBids: [],
      bids: [],
      listening: false,
      unsubscribeBids: null,
      auctionEnded: null,
      bidsVisible: false
    }
  },
  computed: {
    ...mapState(['reserveAuctionContract', 'address', 'debug']),
    ...mapGetters(['weiToETH', 'ethToWei', 'addrShort', 'openSeaLink']),
    bidStepETH () {
      return this.$store.state.auctions.bidStepETH
    },
    auctionEndMs () {
      // TESTING ?
      const testSeconds = new URL(window.location.href).searchParams.get('c')
      if (testSeconds) {
        return this.releaseMs + 1000 * testSeconds
      }
      if (this.auction?.firstBidTime) {
        const start = Number(this.auction.firstBidTime) // sec
        const duration = Number(this.auction.duration) // sec
        return (start + duration) * 1000
      }
      // default 24h from release
      return this.releaseMs + 24 * 60 * 60 * 1000
    },
    minBidETH () {
      let minBid = '0'
      if (this.auction?.reservePrice) {
        const BigInt = window.BigInt
        const reserve = BigInt(this.auction.reservePrice) // wei
        const currentBid = BigInt(this.auction.amount) // wei
        const step = BigInt(this.ethToWei(this.bidStepETH.toString())) // wei
        minBid = currentBid ? currentBid + step : reserve
        minBid = this.weiToETH(minBid.toString()) // eth
      }
      return minBid.toString()
    },
    placeholder () {
      // 0 or 1 if value
      return '0'
      // return this.auction?.amount && Number(this.auction.amount) ? '1.0' : '0'
      // round up minBid to nearest tenth
      // return roundUp(Number(this.minBidETH), 1).toString()
    },
    inputWidth () {
      const digits = Math.max(this.bidETH.length, this.placeholder.length) // length of string
      return digits * 0.44 + 'em'
    }
  },
  // Close the sockets when the component goes away, or a route change leaves
  // them open for the life of the tab. beforeDestroy, not beforeUnmount — this
  // is Vue 2, and the Vue 3 name would simply never be called.
  beforeDestroy () {
    this.teardownBids()
  },

  methods: {
    async getAuction () {
      // console.log(`fetching auction ${this.tokenId}...`)
      this.auction = await this.$store.dispatch('auctions/get', { token: this.tokenId })
      // console.log(`fetched ${this.tokenId}`)

      if (this.auction) {
        this.getBids()
        // TODO check this getter logic...
        this.auctionEnded = this.$store.getters['auctions/auctionEnded']({ auction: this.auction })

        if (!this.auctionEnded) {
          // console.log(this.auction.amount, this.minBidETH)
          // this.bidETH = this.minBidETH
          this.listenToContract()
          this.getBids()
        } else {
          // this.$emit('ended')
        }
      }
    },

    async getBids () {
      this.bids = await this.$store.dispatch('auctions/getPastBids', { token: this.tokenId })
    },

    async bid () {
      // track click
      this.$gtag.event('bidBtnClick', { event_category: 'auction', event_label: 'Auction.vue', value: `${this.tokenId}: ${this.bidETH}ETH` })

      // add to myBids
      const time = new Date().getTime() / 1000 // convert to sec for bidTime
      this.myBids.push({ time, amount: this.bidETH, status: 0 })

      // submit bid
      const bid = await this.$store.dispatch('auctions/bid', { token: this.tokenId, wei: this.ethToWei(this.bidETH) })

      // ...
      if (bid) {
        // success!
        this.removeMyBid(time)
      } else {
        // cancelled / error -> update status
        const bids = [...this.myBids]
        const i = bids.findIndex(bid => bid.time === time)
        if (i > -1) bids[i].status = 2
      }

      // refresh auction
      this.getAuction()
    },

    // async endAuction () {
    //   await this.$store.dispatch('auctions/endAuction', { token: this.tokenId })
    //   this.getAuction()
    // },

    // Sockets outlive the component otherwise, and a route change would leave
    // three connections per visit open.
    teardownBids () {
      if (this.unsubscribeBids) {
        this.unsubscribeBids()
        this.unsubscribeBids = null
        this.listening = false
      }
    },

    listenToContract () {
      if (this.reserveAuctionContract && !this.listening) {
        // new bid !
        // Subscribe on every working endpoint at once and drop duplicates,
        // rather than trusting one socket. A websocket that stops delivering
        // does not error — it goes quiet — and a missed event here is a missed
        // bid. Observed while testing: one endpoint delivered 69 logs in one
        // run and none in the next, with no error either time.
        this.unsubscribeBids = subscribeDeduped({
          Web3,
          urls: WSS_MAINNET,
          abi: this.reserveAuctionContract.options.jsonInterface,
          address: this.reserveAuctionContract.options.address,
          eventName: 'AuctionBid',
          onData: this.onAuctionEvent,
          onError: (error, url) => console.error(`AuctionBid subscription (${url})`, error)
        })

        // auction ended !
        // this.reserveAuctionContract.events
        //   .AuctionEnded()
        //   .on('data', this.onAuctionEvent)
        //   .on('error', (error) => console.error(error))

        this.listening = true
      }
    },

    onAuctionEvent (event) {
      console.log('@auctionEvent', event)
      // refresh if current auction
      if (event.returnValues?.tokenId === this.tokenId.toString()) {
        this.getAuction()
        this.getBids()
      }
    },

    onTimerEnded () {
      this.getAuction()
      // will determine if auction truly ended or extended in last minutes...
    },

    removeMyBid (time) {
      const i = this.myBids.findIndex(bid => bid.time === time)
      if (i > -1) this.myBids.splice(i, 1)
    },

    sameAddr (first, second) {
      return first?.toLowerCase() === second?.toLowerCase()
    },

    async endAuction () {
      // TODO - confirm anyone can end given that end of auction will transfer back to artist?
      const resp = await this.$store.dispatch('auctions/endAuction', { token: this.tokenId })
      console.log(resp)
      this.getAuction()
    },

    bidTime (sec) {
      const date = new Date(Number(sec) * 1000)
      const pad = val => ('0' + val).slice(-2)
      return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` // GMT${pad(date.getTimezoneOffset() / 60)}:00`
    },

    toggleBids () {
      if (!this.auction) return console.warn('no auction to find bids')
      // used in the parent
      if (!this.bidsVisible) {
        if (!this.bids.length) this.getBids()
        this.bidsVisible = true
      } else {
        this.bidsVisible = false
      }
    }
  },
  created () {
    this.auction = this.auctionInit || {}
    this.getAuction()
  },
  watch: {
    tokenId () {
      this.getAuction()
    },
    reserveAuctionContract () {
      this.getAuction()
    },
    address (val, old) {
      if (old === null) {
        // wallet connect doesn't seem to load the auction...
        this.getAuction()
      }
    }
  }
}

/**
 * @param num The number to round
 * @param precision The number of decimal places to preserve
 */
// function roundUp(num, precision) {
//   precision = Math.pow(10, precision)
//   return Math.ceil(num * precision) / precision
// }
</script>

<style lang="postcss">
input[type="number"] {
  background: none;
  /* remove arrows */
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 0;
  }
  &::placeholder{
    @apply text-gray-400 opacity-100;
  }
  &:focus::placeholder{
    @apply text-transparent;
  }
}

.auction input{
  border-bottom:1px solid gray;
}
@media (hover:hover) {
  .auction input:hover{
    border-bottom:1px solid white;
  }
}
.auction input:focus{
  border-bottom:1px solid white;
}
</style>
