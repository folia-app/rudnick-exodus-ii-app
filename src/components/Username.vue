<template lang="pug">
observer.inline.addr(:class="{'addr--is-you': isYou}" @visible="resolveAddress")
  | {{ displayName || '...' }}
</template>

<script>
import { utils } from 'ethers'
import Observer from '@/components/Observer.vue'
export default {
  name: 'Addr',
  props: {
    address: { type: String, default: undefined },
    short: { type: Boolean, default: true },
    // openSeaEnabled: { type: Boolean, default: false },
    youOn: { type: Boolean, default: false },
    ensEnabled: { type: Boolean, default: true }
  },
  computed: {
    isYou () {
      return this.address?.toLowerCase() === this.$store.getters.address?.toLowerCase()
    },
    ensName () {
      return this.$store.state.ensNames[this.address?.toLowerCase()]
    },
    displayName () {
      return this.youOn && this.isYou ? 'YOU'
        : this.ensName ? this.ensName
          : this.short && utils.isAddress(this.address) ? this.$store.getters.addrShort(this.address)
            : this.address
    }
  },
  methods: {
    resolveAddress () {
      if (this.isYou && this.youOn) return

      if (this.ensName !== undefined) return

      if (this.address?.endsWith('.eth')) return

      if (!utils.isAddress(this.address)) {
        console.warn(`${this.address} is not a valid ETH address or ENS name`)
        return
      }

      this.$store.dispatch('ensName', this.address)
    }
  },
  components: { Observer }
}
</script>

<style>
</style>
