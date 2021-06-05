<template lang="pug">
  span.address {{ name || addressFormatted }}
</template>

<script>
export default {
  name: 'Address',
  props: ['address', 'short'],
  data () {
    return {
      name: null
    }
  },
  computed: {
    addressFormatted () {
      let address = this.address
      if (address) {
        address = '0x' + address.slice(2).toUpperCase()
        if (this.short) {
          address = this.$store.getters.addrShort(address)
        }
      }
      return address || '0x...'
    }
  },
  async created () {
    this.name = await this.$store.dispatch('getAddressOpenSeaName', this.address)
  }
}
</script>

<style>
</style>
