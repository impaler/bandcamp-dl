const fs = require('fs')
const path = require('path')

const Nightmare = require('nightmare')
require('nightmare-download-manager')(Nightmare)

const sequences = require('promise-sequences')
const partialRight = require('lodash.partialright')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')

const DEFAULT_DOWNLOAD_PATH = path.join(process.cwd(), '.bandcamp-dl')

const DEFAULT_OPTIONS = {
    username: process.env['NB_USER'],
    password: process.env['NB_PASS'],
    debug: false,
    userAgent: process.env['USER_AGENT'] || 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chromium/58.0.3029.110 Chrome/58.0.3029.110 Safari/537.36',
    concurrent: process.env['NB_CONCURRENT'] || 1,
    downloadPath: process.env['NB_DEST'] || DEFAULT_DOWNLOAD_PATH
}

const bandCampUrl = 'https://bandcamp.com/login'
const bandCampLogoutUrl = 'https://bandcamp.com/logout'

const loginUsernameInputSelector = '#username-field'
const loginPasswordInputSelector = '#password-field'
const loginButtonSelector = 'button[type=submit]'

function downloadCollection (options) {
    options = assignOptions(options)

    return loadCollectionData(options)
        .then(partialRight(filterCollectionSearch, options))
        .then(partialRight(downloadAlbumUrls, options))
}

module.exports = downloadCollection

function assignOptions (options) {
    const debugOptions = !!options.debug ?
    { show: true, waitTimeout: 10000000 } :
    { show: false, waitTimeout: 30 * 1000 }

    options = Object.assign({}, DEFAULT_OPTIONS, options, debugOptions)
    options.paths = { downloads: options.downloadPath }

    mkdirp.sync(options.downloadPath)
    console.log(`The download directory is resolved as ${options.downloadPath}`)
    if (options.debug) {
        console.log(`
Running with options:
${JSON.stringify(options, null, 2)}
        `)
    }

    return options
}

function loadCollectionData (options) {
    console.log(`Logging in as user ${options.username}`)

    return new Nightmare(options)
        .use(login(options))
        .wait('.collection-items')
        .evaluate(evaluateCollectionData)
        .end()
}

function login (options) {
    return nightmare => {
        nightmare
            .useragent(options.userAgent)
            .goto(bandCampLogoutUrl)
            .goto(bandCampUrl)
            .type(loginUsernameInputSelector, '')
            .type(loginUsernameInputSelector, options.username)
            .type(loginPasswordInputSelector, '')
            .type(loginPasswordInputSelector, options.password)
            .click(loginButtonSelector)
    }
}

function evaluateCollectionData () {
    const collectionItems = document.querySelectorAll('.collection-item-container')
    return Array.prototype.map.call(collectionItems, collectionItem => {
        const title = collectionItem.querySelector('.collection-item-title').innerText
        const artist = collectionItem.querySelector('.collection-item-artist').innerText.replace('by ', '')
        const link = collectionItem.querySelector('.redownload-item a').href
        return {
            title, artist, link
        }
    })
}

function filterCollectionSearch (collection, options) {
    if (options.search) {
        const search = new RegExp(options.search)
        collection = collection.filter(item => search.test(item.title) || search.test(item.artist))
        const logAlbum = album => `  - ${album.artist} - ${album.title}`
        console.log(`The search ${options.search} matched ${collection.length} albums.`)
        console.log(`${collection.map(logAlbum).join('\n')}`)
    }
    return collection
}

function downloadAlbumUrls (collection, options) {
    console.log(`
    Now downloading ${options.concurrent} at a time
    `)
    const manifestPath = path.join(options.paths.downloads, `${Date.now()}-collection.json`)
    fs.writeFileSync(manifestPath, JSON.stringify(collection, null, 4))

    const tasks = collection.map(album => () => downloadAlbum(album, options))
    const stepLog = (results, current, total) => console.log(`Download step ${current} of ${total} albums`)
    return sequences.seriesSettled(tasks, options.concurrent, stepLog)
}

function downloadAlbum (album, options) {
    const downloadLocation = {
        'downloads': path.join(options.paths.downloads, sanitize(`${album.artist}-${album.title}`))
    }
    const downloadOptions = Object.assign({},
        options, { paths: downloadLocation }
    )
    let albumDownloadItem

    const nightmare = new Nightmare(downloadOptions)
    nightmare.on('download', onDownload)

    return nightmare
        .useragent(options.userAgent)
        .goto(album.link)
        .evaluate(evalValidateDownloadPage)
        .then(handleDownloadPageValidation)

    function handleDownloadPageValidation (isValid) {
        if (isValid) {
            return continueDownload(nightmare)
        } else {
            return Promise.reject(`There seems to be an issue with the download link page, maybe check the url yourself ${album.link}`)
        }
    }

    function continueDownload (nightmare) {
        return nightmare
            .downloadManager()
            .wait('.format-type')
            .click('.format-type')
            .evaluate(evaluateFormat, options.format)
            .wait(1500)
            .visible('.download-title a')
            .click('.download-title a')
            .waitDownloadsComplete()
            .end()
    }

    function onDownload (state, downloadItem) {
        if (state === 'started') {
            console.log(`
    Downloading ${album.artist} - ${album.title} to:
        ${downloadLocation.downloads}
    From url:
        ${downloadItem.url}
     `)
            nightmare.emit('download', __dirname, downloadItem)
        } else if (state === 'updated') {
            const downloadPercent = ((downloadItem.receivedBytes / downloadItem.totalBytes) * 100)
            console.log(`Download progress ${downloadPercent}%`)
        } else {
            console.log(state)
            console.log(JSON.stringify(downloadItem))
            albumDownloadItem = downloadItem
        }
    }
}

function evalValidateDownloadPage () {
    return !($('.error-text').is(':visible'))
}

function evaluateFormat (format) {
    const formatButtons = document.querySelectorAll('ul.formats li .description')
    const formats = Array.prototype.map.call(formatButtons, button => button.innerText)
    const clickFormatButton = format => {
        for (const clickableFormat of document.querySelectorAll('ul.formats li')) {
            const descriptionElement = clickableFormat.querySelector('.description')
            if (descriptionElement.textContent.includes(format)) {
                $(clickableFormat).click()
            }
        }
    }
    formats.includes(format) && clickFormatButton(format)
}
