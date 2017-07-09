#!/usr/bin/env node
'use strict'
const path = require('path')
const isString = require('util').isString
const isUndefined = require('util').isUndefined
const co = require('co')
const meow = require('meow')
const opener = require('opener');

const bandcampDl = require('../')

const BANDCAMP_URL = 'https://bandcamp.com'

const cli = meow(`
    Usage
      $ bandcamp-dl -u <username> -p <password> -d <download-location>

    Options
      --open, -o     Open the bandcamp website
      --search, -s   Filter what to download with a RegEx on the title or artist of each album
      --username, -u Your bandcamp account username
      --password, -p Your bandcamp account password
      --download, -d The filesystem path location to download to, defaults to cwd
      --format, -f   The preferred format to download albums to eg:
                     "MP3 V0", "MP3 320", "FLAC", "AAC", "Ogg Vorbis",
                     "ALAC", "WAV", "AIFF"
      --debug        Will show the browser window and adds a very long timeout.

    Examples
      $ bandcamp-dl -u Jordan -p Bar -f "MP3 320" -d ~/Downloads/.bandcamp-dl
`, {
    default: {
        download: path.join(process.cwd(), '.bandcamp-dl'),
        format: 'MP3 320',
        debug: false,
    },
    alias: {
        'u': 'username',
        'p': 'password',
        'd': 'download',
        'o': 'open',
        's': 'search',
    }
})

const { username, password, download, format, open, search, debug } = cli.flags

const downloadPath = isString(download) ? path.resolve(download) : undefined

open && opener(BANDCAMP_URL) && process.exit(0)

if (isString(username) && isString(password)) {
    co(run(username, password, downloadPath, format, search, debug))
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
} else if (isUndefined(open)) {
    cli.showHelp(1)
}

function* run (username, password, download, format, search, debug) {
    const result = yield bandcampDl({username, password, downloadPath: download, format, search, debug})
    return result
}
