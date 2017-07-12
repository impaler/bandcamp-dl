# Nightmare Bandcamp

A browser automation script to batch download your private bandcamp collection.

```
npm i impaler/bandcamp-dl -g
```

This provides the `bandcamp-dl` command. So to download your entire collection to `~/Downloads/.bandcamp` run this:

```
bandcamp-dl -d ~/Downloads/.bandcamp --username charles --password secrets
```

A hidden Chromium browser now run's in the background, progress info will print to stdout.

See more options in the help:

```
bandcamp-dl --help
```

You can do other things like specify format and a search filter, eg:

```
bandcamp-dl --format FLAC --search "Amiga500" -u Charles -p secrets -d ~/Downloads/.bandcamp
```

Thanks to [Nightmare](https://github.com/segmentio/nightmare), [Electron](http://electron.atom.io/) and Chromium. With this we can automate almost anything in a web browser.

* Warning this is just a script that automates what an actual user does in the bandcamp website. It is coupled to how the website works at the time of writing the script. Because of this it can break any time bandcamp decides to change their website. If you are keen to help maintain this, see the `--debug` options to show the browser and debug it yourself ;)
