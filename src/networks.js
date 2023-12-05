const mainnet = {
  "id": 1,
  "hex": "0x1",
  "name": "homestead",
  "alias": "mainnet"
}

const sepolia = {
  "id": 11155111,
  "hex": "0xaa36a7",
  "name": "sepolia"
}
const networks = {}
networks[mainnet.id] = mainnet
networks[mainnet.hex] = mainnet
networks[mainnet.name] = mainnet
networks[mainnet.alias] = mainnet

networks[sepolia.id] = sepolia
networks[sepolia.hex] = sepolia
networks[sepolia.name] = sepolia

export default networks
