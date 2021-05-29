<template lang="pug">
  #app
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
  created () {
    document.querySelectorAll('pre').forEach(el => {
      let poem = JSON.parse(el.getAttribute('data-details'))
      poem = { html: el.innerHTML, ...poem }
      this.poems.push(poem)
    })
    console.log(this.poems)
  },
  mounted () {
    return document.getElementById('staticMain')?.remove()
  }
}
</script>

<style>
</style>
