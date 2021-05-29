<template lang="pug">
  section.poem-section
    pre(v-html="poem.html")
    div
      small.block {{ poem.label }}
      p.text-lg.text-gray-500.mt-10
        | + {{ poem.offsetHrs }} hrs
        | <br>{{ releaseMs }}
</template>

<script>
export default {
  name: 'PoemSection',
  props: ['poem', 'start'],
  computed: {
    releaseMs () {
      const ms = new Date(this.start).getTime() + this.poem.offsetHrs * 60 * 60 * 1000
      return new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York' })
    }
  }
}
</script>

<style>
</style>
