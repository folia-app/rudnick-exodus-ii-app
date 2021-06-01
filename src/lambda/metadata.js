import metadata from '../../metadata'
require('dotenv').config()
require('encoding') // netlify build error / missing package??
const domain = process.env.VUE_APP_CANONICAL_DOMAIN

// handler
exports.handler = async function (event, context) {
  try {
    const tokenId = event.path.substr(event.path.lastIndexOf('/') + 1) // 19
    // const networkId = event.queryStringParameters.network ?? '1' // ?network=4

    let token = metadata.tokens[tokenId]

    // !! token must exist in work.tokens list
    if (!token) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Not Found' })
      }
    }

    // the sauce
    token = {
      // both opensea and rarebits
      name: token.title, // || work.titlePattern.replace('{{no}}', printNo(work, tokenId)),

      // owner: owner,
      // name: `${doc.data.artist}, "${doc.data.title}", ${doc.data.year} (${printNo}/${doc.data.edition})`,

      description: metadata.description.replace('{{date}}', token.date || 'XXXX'), // by token ID?

      // all assets related to the work (posterity)
      // directory: token.directory || work.directory,

      // opensea
      external_url: domain, // + '/works/' + workId + '/' + tokenId,
      // rarebits
      home_url: domain, // + '/works/' + workId + '/' + tokenId,

      // opensea
      image: `${domain}/metadata/${tokenId}.svg`,
      // rarebits
      image_url: `${domain}/metadata/${tokenId}.svg`,

      // opensea
      attributes: token.attributes || [],
      // rarebits
      // properties: [
      //   { key: 'zodiac', value: returnZodiac(tokenId), type: 'string' }
      // ],

      // rarebits
      // tags: ['cool', 'hot', 'mild']

      // open sea
      animation_url: `${domain}/metadata/${tokenId}.html`,

      // optimized for folia site
      // animation_url_optim: asset(work, tokenId, 'animation_url_optim'),
      // animation_loop: token.animation_loop,

      youtube_url: ''

      // sha hashes for posterity (annoying for works with many files... IPFS is source file...)
      // sha256: work.sha256 || {}
    }

    // return metadata :)
    return {
      statusCode: 200,
      body: JSON.stringify(token)
    }

  // errors...
  } catch (e) {
    console.error(e)
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 500, message: 'Internal Server Error', error: e })
    }
  }
}
