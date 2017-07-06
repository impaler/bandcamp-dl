const path = require('path')
const downloadCollection = require('./nightmare')

const DEFAULT_DOWNLOAD_PATH = path.join(process.cwd(), 'nightmare-bandcamp')
const show = !(require('util').isNullOrUndefined(process.env['NB_SHOW']))

const options = {
    show,
    format: process.env['NB_FORMAT'] || 'MP3 320',
//   "MP3 V0",
//   "MP3 320",
//   "FLAC",
//   "AAC",
//   "Ogg Vorbis",
//   "ALAC",
//   "WAV",
//   "AIFF"
    userAgent: process.env['USER_AGENT'] || 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chromium/58.0.3029.110 Chrome/58.0.3029.110 Safari/537.36',
    concurrent: process.env['NB_CONCURRENT'] || 1,
    username: process.env['NB_USER'],
    password: process.env['NB_PASS'],
    waitTimeout: show ? 10000000 : 30 * 1000,
    paths: {
        downloads: process.env['NB_DEST'] || DEFAULT_DOWNLOAD_PATH
    }
}

downloadCollection(options)
    .then(result => {
        console.log(result) // todo log resolved rejected
        console.log(`\n\\m/ your private bandcamp collection is now downloaded,
        ... now why don't they offer us this feature ? :_( !!`
        )
        process.exit(0)
    })
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
