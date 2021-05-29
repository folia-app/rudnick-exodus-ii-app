<template lang="pug">
  section.poem-section
    pre(v-html="poem.html")
    div
      small.block {{ poem.label }}
      .flex.items-center.mt-12
        <countdown class="mx-auto" :end="releaseMs"></countdown>
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
