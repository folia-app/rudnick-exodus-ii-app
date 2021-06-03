<template lang="pug">
  #app.pb-135
    poem-section(v-for="poem in poems", :poem="poem", :key="poem.offsetHrs", :start="start")

</template>

<script>
import '@/style/root.css'
import PoemSection from '@/components/PoemSection'
export default {
  name: 'App',
  components: { PoemSection },
  data () {
    return {
      start: 'Sun Jun 05 2021 20:24:26 GMT-0400',
      poems: []
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
          about.classList.add('opacity-100', 'transition', 'duration-500')
          about.classList.remove('pointer-events-none')
          visible = true
        } else {
          hideAbout()
        }
      })
      // overlay click
      about.addEventListener('click', function (e) {
        if (e.target !== this) return // only click on self
        hideAbout()
      })
    }
  },
  created () {
    this.initAbout()
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
