<template lang="pug">
  #app.pb-135
    //- connected address
    .fixed.bottom-0.right-0.p-15.lg_p-30.text-sm.text-white.font-medium
      button(v-if="!address", @click="showDisconnect = false; $store.dispatch('connect')") CONNECT
      template(v-else)
        span.sr-only Connected Address:
        button(@click="showDisconnect = !showDisconnect") {{ addrShort(address) }}
        button.ml-20(v-show="showDisconnect", @click="$store.dispatch('disconnect')") DISCONNECT

    //- poems
    poem-section(v-for="(poem, i) in poems", :poem="poem", :key="poem.offsetHrs", :start="start", :tokenId="i + 1 + tokenSpace")

</template>

<script>
import { mapState, mapGetters } from 'vuex'
import '@/style/root.css'
import PoemSection from '@/components/PoemSection'
export default {
  name: 'App',
  components: { PoemSection },
  data () {
    return {
      start: 'Sun Jun 05 2021 20:24:26 GMT-0400',
      poems: [],
      showDisconnect: false
    }
  },
  computed: {
    ...mapState(['address']),
    ...mapGetters(['addrShort']),
    tokenSpace () {
      return this.$store.state.networkId === 4 ? 1000 : 0
    }
  },
  methods: {
    hideStaticContent () {
      return document.getElementById('staticMain')?.remove()
    },
    getPoems () {
      document.querySelectorAll('pre').forEach(el => {
        let poem = JSON.parse(el.getAttribute('data-details'))
        poem = { html: el.innerHTML, ...poem }
        this.poems.push(poem)
      })
      // console.log(this.poems)
    },
    setStart () {
      // test start ?
      const seconds = new URL(window.location.href).searchParams.get('s')
      if (seconds) {
        // add X seconds
        this.start = new Date().getTime() + Number(seconds) * 1000
      }
    }
  },
  created () {
    this.$store.dispatch('init')
    this.getPoems()
    this.setStart()
  },
  mounted () {
    this.hideStaticContent()
  }
}
</script>

<style>
</style>
