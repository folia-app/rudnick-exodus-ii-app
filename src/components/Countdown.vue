<template lang="pug">
  .countdown.flex.leading-none.text-md.md_text-lg.cursor-default(v-intersect, @intersect="play", @outersect="pause")
    //- {{ timeFormatted }}
    template(v-if="values.includes('y')")
      div
        .text-gray-400 {{ ('0' + timeFormatted.year).slice(-2) }}
        small.block.mt-8.font-medium.text-sm YEAR
      .mx-5 :
    template(v-if="values.includes('d')")
      div
        .text-gray-400 {{ ('00' + timeFormatted.day).slice(-3) }}
        small.block.mt-8.font-medium.text-sm DAY
      .mx-5 :
    template(v-if="values.includes('h')")
      div
        .text-gray-400 {{ ('0' + timeFormatted.hour).slice(-2) }}
        small.block.mt-8.font-medium.text-sm HOUR
      .mx-5 :
    template(v-if="values.includes('m')")
      div
        .text-gray-400 {{ ('0' + timeFormatted.min).slice(-2) }}
        small.block.mt-8.font-medium.text-sm MIN
      .mx-5 :
    template(v-if="values.includes('s')")
      div
        .text-gray-400 {{ ('0' + timeFormatted.sec).slice(-2) }}
        small.block.mt-8.font-medium.text-sm SEC
      .mx-5 :
    template(v-if="values.includes('ms')")
      div
        .text-gray-400 {{ ('00' + timeFormatted.msec).slice(-3) }}
        small.block.mt-8.font-medium.text-sm MSEC
</template>

<script>
export default {
  name: 'CountDown',
  props: {
    end: [String, Number],
    values: { type: String, default: 'y,d,h,m,s,ms' }
  },
  data () {
    return {
      msUntil: 0,
      anim: null
    }
  },
  computed: {
    timeFormatted () {
      return getTimeUntil(this.msUntil)
    },
    endMs () {
      return this.end
      // testing
      // const testMs = process.env.VUE_APP_DEV_COUNTDOWN
      // if (testMs) {
      //   return new Date().getTime() + Number(testMs)
      // }
      // if (this.end) {
      //   return isNaN(this.end) ? new Date(this.end).getTime() : this.end
      // }
      // return undefined
    }
  },
  methods: {
    play () {
      const nowMs = new Date().getTime()
      const msUntil = this.endMs - nowMs
      // end ??
      if (msUntil <= 0) {
        this.msUntil = 0
        this.$emit('ended')
        return
      }
      // update
      this.msUntil = msUntil
      // animation loop
      this.anim = requestAnimationFrame(() => this.play())
    },
    pause () {
      // pause animation
      cancelAnimationFrame(this.anim)
    }
  },
  mounted () {
    this.play()
  },
  destroyed () {
    this.pause()
  }
}

export function getTimeUntil (milliseconds, separator = ' - ', omittSeconds, omittDays) {
  let hour, minute, seconds, day

  seconds = Math.floor(milliseconds / 1000)
  milliseconds = Math.floor(milliseconds % 1000) // ms remaining (after seconds determination)

  minute = Math.floor(seconds / 60)
  seconds = seconds % 60

  hour = Math.floor(minute / 60)
  minute = minute % 60

  day = Math.floor(hour / 24)
  hour = hour % 24

  const year = Math.floor(day / 365)
  day = day % 365

  const time = {
    year: year,
    day: day,
    hour: hour,
    min: minute,
    sec: seconds,
    msec: milliseconds
  }

  return time
}
</script>

<style lang="postcss">
/* countdown labels only appear on hover */
@media (hover:hover) and (min-width: 1024px) {
  .countdown {
    & small {
      opacity: 0;
      transition: opacity 500ms;
    }
    &:hover small {
      opacity: 1;
    }
  }
}
</style>
