<template lang="pug">
.auction(v-if="auction")
  .flex.w-full.justify-center(v-if="!auction.winner")
    //- 24hr countdown
    <countdown :end="auctionEndMs" @ended="onTimerEnded" key="1" values="h,m,s,ms"></countdown>

  //- (bidding UI)
  form.mt-35.w-full.flex.justify-center.items-center(@submit.prevent="bid", v-if="auctionEnded !== true")
    //- bid
    .mx-20.leading-flat.relative
      label.sr-only Enter a bid:
      input.text-md.md_text-lg.block.text-center.focus_outline-none(ref="input", type="number", v-model="bidETH", :min="minBidETH", required, :step="bidStepETH", :style="{minWidth: '1.25em', width: bidETH.toString().length * 2.5 + 'rem'}")
      small.block.absolute.w-full.pt-8.left-0.text-sm.text-white.font-medium ETH
    //- bid btn
    btn.mx-10.lg_mb-7.px-20(type="submit") BID

  //- (end/claim)
  btn.mt-35.-mb-10.mx-auto.px-15(v-else-if="auctionEnded && !auction.winner", @click.native="endAuction")
    template(v-if="sameAddr(address, auction.bidder)") CLAIM
    template(v-else) END

  //- (winner)
  .mt-20.text-base.font-medium(v-else-if="auction.winner", @click="")
    a.lg_hover_text-white(:href="openSeaLink({account: auction.winner})", target="_blank", rel="noopener noreferrer")
      username(:address="auction.winner")

  //- bid lists
  .mt-50.w-full.flex.justify-center.font-medium.text-base(v-if="auction && (!auction.winner || bidsVisible)")
    .w-full.lg_w-3x4.xl_w-2x3.px-15.mx-auto.w-auto
      //- my bids
      ul.mb-30.text-gray-500.flex.flex-col-reverse(v-if="myBids.length")
        li.w-full.flex.justify-between.group(v-for="bid in myBids")
          div {{ bid.status === 2 ? 'ERROR/CANCELLED' : 'BIDDING...' }}
          div.group-hover_hidden {{ bid.amount }}
          button.hidden.group-hover_block.text-white(@click="removeMyBid(bid.time)") DELETE

      //- all bids list
      ul.text-gray-500
        li.w-full.flex.justify-between.hover_text-white(v-for="(bid, i) in bids", :class="{'text-white': (sameAddr(auction.winner, bid.sender) || sameAddr(auction.bidder, bid.sender)) && auction.amount === bid.value && i === 0}")
          //- time
          div.md_min-w-1x5.text-left.whitespace-no-wrap.flex-shrink-0 {{ bidTime(bid.timestamp) }}
          //- bidder
          .min-w-0.flex-auto.mx-12.text-left.md_text-center
            div.truncate
              a(:href="openSeaLink({account: bid.sender})", target="_blank", rel="noopener noreferrer")
                template(v-if="sameAddr(address, bid.sender)") YOU
                username(v-else, :address="bid.sender")
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
import { mapState, mapGetters } from 'vuex'
import Countdown from './Countdown'
import Btn from './Btn'
import Username from './Username'
export default {
  name: 'Auction',
  props: ['releaseMs', 'tokenId'],
  components: { Countdown, Btn, Username },
  data () {
    return {
      auction: {},
      bidETH: '0',
      myBids: [],
      bids: [],
      listening: false,
      auctionEnded: null,
      bidsVisible: false
    }
  },
  computed: {
    ...mapState(['reserveAuctionContract', 'address']),
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
        return (Number(this.auction.firstBidTime) + Number(this.auction.duration)) * 1000
      }
      // default 24h from release
      return this.releaseMs + 24 * 60 * 60 * 1000
    },
    minBidETH () {
      let minBid = '0'
      if (this.auction?.reservePrice) {
        const reserve = Number(this.weiToETH(this.auction.reservePrice))
        const currentBid = Number(this.weiToETH(this.auction.amount))
        minBid = currentBid ? Number(currentBid + this.bidStepETH).toFixed(1) : reserve
      }
      return minBid.toString()
    }
  },
  methods: {
    async getAuction () {
      this.auction = await this.$store.dispatch('auctions/get', { token: this.tokenId })
      if (this.auction) {
        // TODO check this getter logic...
        this.auctionEnded = this.$store.getters['auctions/auctionEnded']({ auction: this.auction })
        // this.bidETH = this.minBidETH
        if (!this.auctionEnded) {
          this.bidETH = this.minBidETH
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
      const time = new Date().getTime()
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
    },

    // async endAuction () {
    //   await this.$store.dispatch('auctions/endAuction', { token: this.tokenId })
    //   this.getAuction()
    // },

    listenToContract () {
      if (this.reserveAuctionContract && !this.listening) {
        // new bid !
        this.reserveAuctionContract.events
          .AuctionBid()
          .on('data', this.onAuctionEvent)
          .on('error', (error) => console.error(error))

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
      console.log('clicky')
      // TODO - confirm anyone can end given that end of auction will transfer back to artist?
      const resp = await this.$store.dispatch('auctions/endAuction', { token: this.tokenId })
      console.log('after', resp)
      this.getAuction()
    },

    bidTime (sec) {
      const date = new Date(Number(sec) * 1000)
      const pad = val => ('0' + val).slice(-2)
      return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDay())}  ${date.getHours()}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` // GMT${pad(date.getTimezoneOffset() / 60)}:00`
    },

    toggleBids () {
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
    this.getAuction()
  },
  watch: {
    tokenId () {
      this.getAuction()
    },
    reserveAuctionContract () {
      this.getAuction()
    }
  }
}
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
}
</style>
