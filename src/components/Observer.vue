<template lang="pug">
span
  slot
</template>

<script>
export default {
  name: 'IntersectionObserver',
  props: {
    threshold: { type: [Array, Number], default: 0.5 }
    // log: {type: Boolean, default: false}
  },
  data () {
    return {
      observer: null
    }
  },
  mounted () {
    this.observe()
    this.$emit('mounted')
  },
  methods: {
    observe () {
      if (!window.IntersectionObserver) { return this.$emit('visible') }
      // reset
      if (this.observer) { this.observer.unobserve(this.$el) }
      // observe
      const callback = (entries) => {
        const ratio = entries[0] && entries[0].intersectionRatio
        if (typeof this.threshold === 'number') {
          return ratio >= this.threshold ? this.$emit('visible') : this.$emit('hidden')
        } else {
          this.$emit('ratio', ratio)
          // this.$emit('entry', entries[0])
        }
      }
      this.observer = new IntersectionObserver(callback, { threshold: this.threshold })
      this.observer.observe(this.$el)
    }
  }
}
</script>

<style>
</style>
