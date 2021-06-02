<template lang="pug">
  section.poem-section.transition-color.duration-1000(:class="{'text-gray-500': !auctionStatus}")
    pre.text-poem-sm.lg_text-lg.cursor-default(v-html="poem.html")
    div
      small.block.text-sm {{ poem.label }}

      //- (auction asleep)
      template(v-if="auctionStatus === 0")
        .mt-12.flex.w-full.justify-center
          <countdown :end="releaseMs" @ended="auctionStatus = 1" key="releaseMs" :pending="true"></countdown>

      //- (auction active !)
      template(v-else-if="auctionStatus === 1")
        auction.mt-12(:releaseMs="releaseMs", @ended="auctionStatus = 2", :tokenId="tokenId")

      //- (acution ended)
      template(v-else-if="auctionStatus === 2")
        .mt-12.w-full.text-center.truncate
          a(href="http://etherscan.io/address/0xaF2CE0962D1a4B1AAB10f7faA62bBbcA40a8EA53", target="_blank")
            | 0x{{'aF2CE0962D1a4B1AAB10f7faA62bBbcA40a8EA53'.toUpperCase()}}

            //- bids
      //- p.text-lg.text-gray-500.mt-10.text-center
        | + {{ poem.offsetHrs }} hrs
        | <br>{{ readable }}
        |
</template>

<script>
import Countdown from '@/components/Countdown'
import Auction from '@/components/Auction'
export default {
  name: 'PoemSection',
  props: ['poem', 'start', 'tokenId'],
  components: { Countdown, Auction },
  data () {
    return {
      auctionStatus: 0,
      bidsVisible: false
    }
  },
  computed: {
    releaseMs () {
      return new Date(this.start).getTime() + this.poem.offsetHrs * 60 * 60 * 1000
    },
    readable () {
      return new Date(this.releaseMs) // .toLocaleString('en-US', { timeZone: 'America/New_York' })
    }
  }
}
</script>

<style>
</style>
