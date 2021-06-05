<template lang="pug">
  #app.pb-135
    //- connected address
    .fixed.bottom-0.right-0.p-15.lg_p-30.text-sm.text-white.font-medium
      button(v-if="!address", @click="$store.dispatch('connect')") CONNECT
      template(v-else)
        span.sr-only Connected Address:
        button(@click="showDisconnectButton")
          username(:address="address", :short="true")
        button.ml-20(v-show="disconnectVisible", @click="$store.dispatch('disconnect')") DISCONNECT

    //- poems
    poem-section(v-for="(poem, i) in poems", :poem="poem", :key="poem.offsetHrs", :start="start", :tokenId="i + 1 + tokenSpace", @sunrise="now = new Date()")

    //- horizon line
    <img src="./assets/void.png" class="fixed w-full block top-150ff top-130 sm_top-horizon z-40 left-0 pointer-events-none transition duration-1000" :class="{'opacity-0': !horizonVisible}" />
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import '@/style/root.css'
import PoemSection from '@/components/PoemSection'
import Username from '@/components/Username'
export default {
  name: 'App',
  components: { PoemSection, Username },
  data () {
    return {
      start: 'Sun Jun 05 2021 20:24:26 GMT-0400',
      poems: [],
      disconnectVisible: false,
      tmout: null,
      now: new Date()
    }
  },
  computed: {
    ...mapState(['address']),
    ...mapGetters(['addrShort']),
    tokenSpace () {
      const space = process.env.VUE_APP_TOKENSPACE ?? 0
      return space // this.$store.state.networkId === 4 ? 1000 : 0
    },
    horizonVisible () {
      return this.$store.state.debug || this.now > new Date(this.start)
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
    },
    initAbout () {
      const about = document.getElementById('about')
      about.classList.add('fixed', 'top-0', 'left-0', 'w-full', 'h-full', 'opacity-0', 'pointer-events-none')
      const btn = document.getElementById('aboutBtn')
      let visible = false
      function hideAbout () {
        about.classList.add('pointer-events-none')
        about.classList.remove('opacity-100')
        visible = false
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        if (!visible) {
          // show
          about.classList.add('opacity-100', 'transition', 'duration-500')
          about.classList.remove('pointer-events-none')
          visible = true
          document.body.style.overflow = 'hidden'
        } else {
          // hide
          hideAbout()
          document.body.style.overflow = ''
        }
      })
      // overlay click
      about.addEventListener('click', function (e) {
        if (e.target !== this) return // only click on self
        hideAbout()
      })
    },
    showDisconnectButton () {
      clearTimeout(this.tmout)
      this.disconnectVisible = true
      this.tmout = setTimeout(() => {
        this.disconnectVisible = false
      }, 1500)
    }
  },
  created () {
    this.getPoems()
    this.initAbout()
    this.$store.dispatch('init')
    this.setStart()
  },
  mounted () {
    this.hideStaticContent()
  }
}
</script>

<style>
</style>
