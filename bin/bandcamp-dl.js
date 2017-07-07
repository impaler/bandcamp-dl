#!/usr/bin/env node
'use strict'

const path = require('path')
const isString = require('util').isString
const co = require('co')
const meow = require('meow')

const bandcampDl = require('../')

const cli = meow(`
    Usage
      $ bandcamp-dl -u <username> -p <password> -d <download-location>

    Options
      --username, -u Your bandcamp account username
      --password, -p Your bandcamp account password
      --download, -d The filesystem path location to download to, defaults to cwd
      --format, -f   The preferred format to download albums to eg:
                     "MP3 V0", "MP3 320", "FLAC", "AAC", "Ogg Vorbis",
                     "ALAC", "WAV", "AIFF"

    Examples
      $ bandcamp-dl -u Jordan -p Bar -f "MP3 320" -d ~/Downloads/.bandcamp-dl
`, {
    default: {
        download: path.join(process.cwd(), '.bandcamp-dl')
    },
    alias: {
        'u': 'username',
        'p': 'password',
        'd': 'download',
    }
})

const { username, password, download, format } = cli.flags

const downloadPath = isString(download) ? path.resolve(download) : undefined

if (isString(username) && isString(password)) {
    co(run(username, password, downloadPath, format))
        .then(result => {
            console.log(result)
            console.log(`\n\\m/ your private bandcamp collection is now downloaded,
            ... now why don't they offer us this feature ? :_( !!`
            )
            process.exit(0)
        })
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
} else {
    cli.showHelp(1)
}

function* run (username, password, download, format) {
    const result = yield bandcampDl({username, password, downloadPath: download, format})
    return result
}
