const fs = require('fs')
const filesize = require('filesize')
const path = require('path')
const request = require('request')
const progress = require('progress-stream')
const Nightmare = require('nightmare')
const sequences = require('promise-sequences')
const partialRight = require('lodash.partialright')
const mkdirp = require('mkdirp')
const unzip = require('unzip-wrapper')
const TEMP_DIR = path.join(require('os').tmpdir(), 'bandcamp')

const bandCampUrl = 'https://bandcamp.com/login'
const bandCampLogoutUrl = 'https://bandcamp.com/logout'
const usernameInputSelector = '#username-field'
const passwordInputSelector = '#password-field'
const submitButtonSelector = '#submit'
const downloadItemLinkSelectors = '.collection-item-container > div.collection-item-details-container > span.redownload-item > a'
const downloadButtonSelector = 'div.download-rightcol > .downloadStatus > .downloadGo'

var options = {
    show: process.env['NB_SHOW'] || false,
    format: 'mp3-320', //todo expose, collect available and fallback with highest possible
    concurrent: process.env['NB_CONBURRENT'] || 1,
    username: process.env['NB_USER'],
    password: process.env['NB_PASS'],
    destination: process.env['NB_DEST'],
}

downloadCollection(options)
    .then((result) => {
        console.log('\\m/ your bandcamp collection is now downloaded, keep it growing!')
        console.log(result)
        process.exit(0)
    })
    .catch((error) => {
        console.error('Run error')
        console.error(error)
        process.exit(1)
    })

function downloadCollection(options) {
    options = validateDownloadDestination(options)

    return getCollectionDownloadPageUrls(options)
        .then(logPagesProgress)
        .then(partialRight(downloadAlbumUrls, options))
}

function validateDownloadDestination(options) {
    if (typeof options.destination === 'undefined') {
        options.destination = path.join(process.cwd(), 'downloads')
        console.log('To download to a custom location use "NB_DEST" ENV variable to set the destination')
    }
    options.unzipDestination = path.join(options.destination, 'music')
    options.zipDestination = path.join(options.destination, 'zips')

    mkdirp.sync(options.zipDestination)
    mkdirp.sync(options.unzipDestination)
    mkdirp.sync(TEMP_DIR)

    console.log(`Download temp dir ${TEMP_DIR}`)
    console.log(`Downloading music to ${options.destination}`)

    return options
}

function getCollectionDownloadPageUrls(options) {
    console.log(`Logging in as user ${options.username}`)

    return new Nightmare(options)
        .use(login(options.username, options.password))
        .wait('#collection-container')
        .use(getMusicDownloadPageUrls(downloadItemLinkSelectors))
        .end()
}

function login(username, password) {
    return (nightmare) => {
        nightmare
            .goto(bandCampLogoutUrl)
            .goto(bandCampUrl)
            .type(usernameInputSelector, '')
            .type(usernameInputSelector, username)
            .type(passwordInputSelector, '')
            .type(passwordInputSelector, password)
            .click(submitButtonSelector)
            .wait()
    }
}

function getMusicDownloadPageUrls(downloadItemLinkSelectors) {
    return nightmare => {
        nightmare.evaluate(evaluateDownloadItemLinks, downloadItemLinkSelectors)
    }

    function evaluateDownloadItemLinks(downloadItemLinkSelectors) {
        var links = document.querySelectorAll(downloadItemLinkSelectors)
        var linkHrefs = Array.prototype.map.call(links, link => link.href)
        return linkHrefs
    }
}

function logPagesProgress(urls) {
    console.log(`Found ${urls.length} to download`)
    return Promise.resolve(urls)
}

function downloadAlbumUrls(urls, options) {
    console.log(`About to download ${urls.length} albums, ${options.concurrent} at a time`)
    
    var tasks = urls.map(url => downloadAlbum.bind(undefined, url, options))
    return sequences.seriesSettled(tasks, options.concurrent)
}

function downloadAlbum(url, options) {
    return getAlbumDownloadLink(url, options)
        .then(partialRight(downloadBandcampZip, options))
        .then(partialRight(unzipMusic, options))
}

function unzipMusic(zipResult, options) {
    return new Promise((resolve, reject) => {
        var unzipDestination = path.join(options.unzipDestination, zipResult.musicName)
        var unzipOptions = {
            fix: true,
            target: unzipDestination,
        }
        mkdirp(unzipDestination, unzipMusic)

        function unzipMusic(err) {
            if (err) reject(err)

            unzip(zipResult.zipPath, unzipOptions, (err) => {
                if (err) reject(err)
                console.log(`Unzipping ${unzipDestination} done!`)
                resolve()
            })
        }
    })
}

function getAlbumDownloadLink(url, options) {
    return new Nightmare(options)
        .useragent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36")
        .goto(url)
        .wait(downloadButtonSelector)
        .wait(1000)
        .click('#downloadFormatMenu0')
        .wait('#formatMenu2')
        .wait(downloadButtonSelector)
        .wait(2000)
        .evaluate(clickMusicFormat, options.format)
        .wait(2000)
        .wait(downloadButtonSelector)
        .evaluate(getDownloadUrl, downloadButtonSelector)
        .end()

    function getDownloadUrl(downloadButtonSelector) {
        return document.querySelector(downloadButtonSelector).href
    }

    function clickMusicFormat(format) {
        // something fishy about the bandcamp site requires the mouseenter
        $(`.ui-menu-item[data-value=${format}]`).trigger('mouseenter')
        $(`.ui-menu-item[data-value=${format}]`).click()
    }
}

function downloadBandcampZip(musicLink, options) {
    return new Promise((resolve, reject) => {
        var downloadFileName = path.join(TEMP_DIR, (new Date().getTime()) + '.zip')
        var progressStreamOptions = {time: 1000}
        var progressStream = progress(progressStreamOptions)
            .on('progress', progress => console.log(`downloaded ${Math.round(progress.percentage)}% of ${musicLink}`))
            .on('finish', onStreamFinish)
        var musicName = `download-${new Date().getTime()}`

        request
            .get(musicLink)
            .on('error', reject)
            .on('response', onResponse)
            .pipe(progressStream)
            .pipe(fs.createWriteStream(downloadFileName))

        function onResponse(response) {
            progressStream.setLength(response.headers['content-length'])
            var contentDisposition = response.headers['content-disposition']
            console.log(`Downloading zip file ${filesize(response.headers['content-length'])}`)

            if (typeof contentDisposition !== 'undefined') {
                var fileNameMatch = /(?:filename\*=UTF-8'')(.*)(?:.zip)/.exec(contentDisposition)
                if (fileNameMatch[1]) {
                    musicName = `${decodeURIComponent(fileNameMatch[1])}`
                    return
                }
            }
            console.error('unable to determine filename from the response headers')
        }

        function onStreamFinish() {
            var zipFileName = musicName + '.zip'
            zipPath = path.join(options.zipDestination, zipFileName)
            fs.rename(downloadFileName, zipPath, () => resolve({
                zipFileName, musicName, zipPath
            }))
        }
    })
}