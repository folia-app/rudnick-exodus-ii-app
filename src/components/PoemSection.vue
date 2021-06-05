<template lang="pug">
  section.poem-section.transition-color.duration-1000(:class="{'text-gray-500': !auctionStatus}")
    pre.text-poem-sm.lg_text-lg.cursor-default(v-html="poem.html", @click="onPoemClick", v-intersect="0.01", @intersect="getAuction")
    div
      small.block.text-sm
        a(:href="`https://opensea.io/assets/0x76e422de0ce8842ebe837bc7ab6984b4fff88055/${tokenId}`", target="_blank", rel="noopener noreferrer", class="lg_hover_text-white transition duration-100")
          | {{ poem.label }}

      //- (auction asleep)
      template(v-if="auctionStatus === 0")
        .mt-12.flex.w-full.justify-center
          <countdown :end="releaseMs" @ended="onUnlockTimerEnd" key="releaseMs" :pending="true"></countdown>

      //- (auction active / ended !)
      template(v-else-if="auctionStatus === 1")
        auction.mt-12(ref="auction", :releaseMs="releaseMs", :tokenId="tokenId", :auctionInit="auction")

    //- debug info
    .text-gray.text-lg(v-if="$store.state.debug")
      | + {{ poem.offsetHrs }} hrs<br>
      | {{ new Date(releaseMs).toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }) }}<br>
      | {{ new Date(releaseMs) / 1000 }} sec<br>
      //- | {{ releaseMs }} msec

</template>

<script>
import { mapState } from 'vuex'
import Countdown from '@/components/Countdown'
import Auction from '@/components/Auction'
export default {
  name: 'PoemSection',
  props: ['poem', 'start', 'tokenId'],
  components: { Countdown, Auction },
  data () {
    return {
      auctionStatus: 0,
      bidsVisible: false,
      auction: null,
      hasIntersected: false
    }
  },
  computed: {
    ...mapState(['reserveAuctionContract']),
    releaseMs () {
      let releaseMs = new Date(this.start).getTime() + this.poem.offsetHrs * 60 * 60 * 1000
      if (this.auction?.firstBidTime) {
        releaseMs = new Date(Number(this.auction.firstBidTime) * 1000).getTime()
      }
      return releaseMs
    },
    readable () {
      return new Date(this.releaseMs) // .toLocaleString('en-US', { timeZone: 'America/New_York' })
    }
  },
  methods: {
    onPoemClick () {
      // testing ?
      // if (this.$store.state.networkId === 4) {
      //   this.auctionStatus = 1
      // }
      return this.$refs.auction?.toggleBids()
    },
    async getAuction () {
      this.hasIntersected = true
      if (this.auction === null) {
        this.auction = await this.$store.dispatch('auctions/get', { token: this.tokenId })
        // ended?
        if (this.auction?.winner) {
          this.auctionStatus = 1
        }
      }
    },
    onUnlockTimerEnd () {
      this.auctionStatus = 1
      this.$emit('sunrise')
    }
  },
  watch: {
    reserveAuctionContract () {
      if (this.hasIntersected && this.auction === null) {
        this.getAuction()
      }
    }
  }
}
</script>

<style>
</style>
