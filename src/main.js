import Vue from 'vue'
import App from './App.vue'
// import './registerServiceWorker'
import store from './store'
import analytics from './plugins/vue-gtag'

// Global directive to observe element visibility
// <div v-observe="0.1" @visible, @hidden>
Vue.directive('intersect', {
  inserted: function (el, binding, vnode) {
    const threshold = binding.value || 0.01 // v-observe="0.1"
    const onIntersection = entries => {
      const eventName = entries[0].isIntersecting ? 'intersect' : 'outersect'
      // emit...
      if (vnode.componentInstance) {
        // component ?
        vnode.componentInstance.$emit(eventName) // , {detail: eventDetail}); // use {detail:} to be uniform
      } else {
        // vanilla DOM element
        vnode.elm.dispatchEvent(new CustomEvent(eventName)) // , {detail: eventDetail}));
      }
    }
    // observe!
    el.observer = new IntersectionObserver(onIntersection, { threshold })
    el.observer.observe(el)
  }
  // unbind: function (el) {
  //   el.observer.unobserve(el)
  // }
})

new Vue({
  store,
  render: h => h(App),
  mounted () {
    analytics()
  }
}).$mount('#app')
