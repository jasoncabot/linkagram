import Phaser from 'phaser'

import WebFontLoader from 'webfontloader'

export default class WebFontFile extends Phaser.Loader.File {
    fontNames: string[]

    /**
     * @param {Phaser.Loader.LoaderPlugin} loader
     * @param {string | string[]} fontNames
     */
    constructor(loader: Phaser.Loader.LoaderPlugin, fontNames: string | string[]) {
        super(loader, {
            type: 'webfont',
            key: fontNames.toString()
        })

        this.fontNames = Array.isArray(fontNames) ? fontNames : [fontNames]
    }

    load() {
        const config = {
            active: () => {
                this.loader.nextFile(this, true)
            },
            google: {
                families: this.fontNames
            }
        }

        WebFontLoader.load(config)
    }
}