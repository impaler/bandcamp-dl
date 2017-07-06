const fs = require('fs')
const path = require('path')

const Nightmare = require('nightmare')
require('nightmare-download-manager')(Nightmare)

const sequences = require('promise-sequences')
const partialRight = require('lodash.partialright')
const mkdirp = require('mkdirp')
const sanitize = require('sanitize-filename')

const bandCampUrl = 'https://bandcamp.com/login'
const bandCampLogoutUrl = 'https://bandcamp.com/logout'

const loginUsernameInputSelector = '#username-field'
const loginPasswordInputSelector = '#password-field'
const loginButtonSelector = 'button[type=submit]'

function downloadCollection (options) {
    validateDownloadDestination(options)

    return getCollectionData(options)
        .then(partialRight(downloadAlbumUrls, options))
}

module.exports = downloadCollection

function validateDownloadDestination (options) {
    mkdirp.sync(options.paths.downloads)
    console.log(`Download collection to the directory: ${options.paths.downloads}`)

    return options
}

function getCollectionData (options) {
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

function downloadAlbumUrls (collection, options) {
    console.log(`Found ${collection.length} albums in your collection, now ${options.concurrent} at a time`)
    const manifestPath = path.join(options.paths.downloads, `${Date.now()}-collection.json`)
    fs.writeFileSync(manifestPath, JSON.stringify(collection, null, 4))

    // collection = [collection[11]]

    const tasks = collection.map(album => () => downloadAlbum(album, options))
    return sequences.seriesSettled(tasks, options.concurrent)
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
            console.log(`Download started from url `)
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
