# Nightmare Bandcamp

Need a way to batch download your awesome bandcamp collection?
You know how time consuming it currently is, so why not automate it?

Thanks to [Nightmare](https://github.com/segmentio/nightmare)'s 
use of [Electron](http://electron.atom.io/) running this script is 
standalone.

You can run the script from the project's cwd like so:

    NB_PASS=foo NB_USER=bar NB_CONCURRENT=3 NB_SHOW=true node index.js