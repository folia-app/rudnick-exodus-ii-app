<template lang="pug">
  section.poem-section.transition-color.duration-1000(:class="{'text-gray-500': !auctionStatus}")
    pre.text-poem-sm.lg_text-lg.cursor-default(v-html="poem.html")
    div
      small.block.text-sm {{ poem.label }}

      //- (auction asleep)
      template(v-if="auctionStatus === 0")
        .mt-12.flex.w-full.justify-center
          <countdown :end="releaseMs" @ended="auctionStatus = 1" key="0"></countdown>

      //- (auction active !)
      template(v-else-if="auctionStatus === 1")
        .mt-12.flex.w-full.justify-center
          //- 24hr countdown
          <countdown :end="auctionEndMs" @ended="auctionStatus = 2" key="1" values="h,m,s,ms"></countdown>
        //- bid UI
        div.mt-35.w-full.flex.justify-center.items-center
          //- bid
          .mx-20.leading-flat.relative
            span.text-md.md_text-lg 0.0
            small.block.absolute.w-full.pt-8.left-0.text-sm.text-white.font-medium ETH
          //- bid btn
          button.mx-10.lg_mb-7.h-30.flex.items-center.pt-2.border.border-gray-500.rounded-full.px-20.leading-flat.lg_hover_bg-white.lg_hover_text-black.focus_bg-white.focus_text-black.lg_hover_border-white.focus_border-white.text-sm.font-medium BID

        //- bids list
        ul.mt-50.flex.justify-center.mx-auto.font-medium.text-base
          .max-w-full.px-15.mx-auto.w-auto.flex.flex-col-reverse(v-if="auctionStatus", v-show="auctionStatus === 1 || bidsVisible")
            li.w-full.flex.justify-between(v-for="n in 12")
              .min-w-0.flex-auto.text-left
                div.truncate
                  a(href="http://etherscan.io/address/0xaF2CE0962D1a4B1AAB10f7faA62bBbcA40a8EA53", target="_blank")
                    | 0x{{'aF2CE0962D1a4B1AAB10f7faA62bBbcA40a8EA53'.toUpperCase()}}
              div.ml-30 {{ (n - 1) / 10 }}

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
export default {
  name: 'PoemSection',
  props: ['poem', 'start'],
  components: { Countdown },
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
    auctionEndMs () {
      // todo check contract for end time
      const testSeconds = new URL(window.location.href).searchParams.get('c')
      if (testSeconds) {
        return this.releaseMs + 1000 * testSeconds
      }
      return this.releaseMs + 24 * 60 * 60 * 1000
    },
    readable () {
      return new Date(this.releaseMs) // .toLocaleString('en-US', { timeZone: 'America/New_York' })
    }
  }
}
</script>

<style>
</style>
