import Vue from 'vue'
import VueGtag, { exception } from 'vue-gtag'

// import router from '@/router'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

const gaID = process.env.VUE_APP_GOOGLE_ANALYTICS_ID

// honor doNotTrack?
// or is that more for ad-tracking?
// const doNotTrack = window.navigator.doNotTrack === '1'
export default function () {
  if (!gaID) {
    console.warn('Missing environment variable: VUE_APP_GOOGLE_ANALYTICS_ID')
  } else {
    (async () => {
      // We recommend to call `load` at application startup.
      const fp = await FingerprintJS.load()

      // The FingerprintJS agent is ready.
      // Get a visitor identifier when you'd like to.
      const result = await fp.get()

      // This is the visitor identifier:
      const visitorId = result.visitorId

      // init
      Vue.use(VueGtag, {
        enabled: true,
        config: {
          id: gaID,
          params: {
            client_id: visitorId,
            anonymize_ip: true,
            client_storage: 'none' // no cookie :)
          }
        }
      })

      // track errors
      window.addEventListener('error', (e) => {
        exception({
          description: `@windowError: ${e.message} | userAgent: ${window.navigator.userAgent} | winW: ${window.innerWidth}`,
          fatal: false
        })
      })
    })()
  }
}
