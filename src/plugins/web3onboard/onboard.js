import walletConnectModule from '@web3-onboard/walletconnect'
import Onboard from '@web3-onboard/core'
import injectedModule from '@web3-onboard/injected-wallets'
import myLogo from './folia-logo-svg-string.js'

// const network = import.meta.env.VITE_NETWORK
// Keyless. web3-onboard takes one url per chain, so this is a single address
// rather than a pool.
const MAINNET_RPC = import.meta.env.VITE_RPC_MAINNET || 'https://gateway.tenderly.co/public/mainnet'

const injected = injectedModule()
const wcV2InitOptions = {
  projectId: import.meta.env.VITE_WC,
  dappUrl: import.meta.env.VITE_CANONICAL_DOMAIN, // "https://nft.folia.app"
  requiredChains: [1],
  // optionalChains: [11155111],
  version: 2, // **New Param** Defaults to version: 1 - this behavior will be deprecated after the WalletConnect v1 sunset
  // handleUri: handleURI => console.log({ handleURI }),
}
const walletConnect = walletConnectModule(wcV2InitOptions)
const onboard = Onboard({
  theme: 'dark',
  // head to https://explorer.blocknative.com/account to sign up for free
  // apiKey: import.meta.env.VITE_BLOCKNATIVE,
  wallets: [injected, walletConnect],
  chains: [
    {
      id: 1,
      token: 'ETH',
      label: 'Ethereum Mainnet',
      rpcUrl: MAINNET_RPC
    },
    // {
    //   id: 11155111,
    //   token: 'ETH',
    //   label: 'Sepolia',
    //   rpcUrl: 'https://rpc.sepolia.org/'
    // },
  ],
  connect: {
    autoConnectLastWallet: true,
    showSidebar: false,
    removeWhereIsMyWalletWarning: true
  },
  appMetadata: {
    name: 'EXODUS II',
    // explorer: 'http://localhost:5173',
    icon: myLogo, // svg string icon
    // logo: myLogo, // svg string logo
    description: 'by David Rudnick',
    recommendedInjectedWallets: [
      { name: 'MetaMask', url: 'https://metamask.io' },
      // { name: 'Coinbase', url: 'https://wallet.coinbase.com/' }
    ]
  },
  notify: {
    desktop: {
      enabled: true,
      transactionHandler: transaction => {
        console.log({ transaction })
        if (transaction.eventCode === 'txPool') {
          return {
            type: 'success',
            message: 'Your transaction from #1 DApp is in the mempool',
          }
        }
      },
      position: 'bottomLeft'
    },
    mobile: {
      enabled: true,
      transactionHandler: transaction => {
        console.log({ transaction })
        if (transaction.eventCode === 'txPool') {
          return {
            type: 'success',
            message: 'Your transaction from #1 DApp is in the mempool',
          }
        }
      },
      position: 'topRight'
    }
  },
  accountCenter: {
    desktop: {
      enabled: false,
      position: 'topRight',
      minimal: true,
      // containerElement: '#appAccountCenter',
    },
    mobile: {
      enabled: false,
      position: 'topRight',
      minimal: true
    }
  },
  disableFontDownload: true,
  // i18n: {
  //   en: {
  //     // connect: {
  //     //   selectingWallet: {
  //     //     header: 'custom text header'
  //     //   }
  //     // },
  //     notify: {
  //       transaction: {
  //         txStuck: 'custom text for this notification event'
  //       },
  //       watched: {
  //         // Any words in brackets can be re-ordered or removed to fit your dapps desired verbiage
  //         "txPool": "Your account is {verb} {formattedValue} {asset} {preposition} {counterpartyShortened}"
  //       }
  //     }
  //   },
  //   es: {
  //     transaction: {
  //       txRequest: 'Su transacción está esperando que confirme'
  //     }
  //   }
  // }
})

export default onboard