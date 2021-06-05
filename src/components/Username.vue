<template lang="pug">
  span.address {{ username || addressFormatted }}
</template>

<script>
export default {
  name: 'Address',
  props: ['address', 'short'],
  computed: {
    username () {
      return this.$store.state.names[(this.address || '').toLowerCase()]
    },
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
    this.$store.dispatch('getAddressOpenSeaName', this.address)
  }
}
</script>

<style>
</style>
