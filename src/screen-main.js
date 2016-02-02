/* global module */

var V = require('vector2');
var UI = require('ui');
var Settings = require('settings');

module.exports.DEMO_MODE = false;

var demoProps = {
    song: 'Open Eye Signal',
    artist: 'Jon Hopkins',
    album: 'Immunity',
    artist: 'Moderat',
    album: 'Moderat',
    song: 'A New Error',
    showClock: true,
    isPlaying: true
};

if (module.exports.DEMO_MODE) {
    Settings.option('showClock', demoProps.showClock);
}

module.exports.actionDef = {
    up: 'images/previous.png',
    select: module.exports.DEMO_MODE && demoProps.isPlaying ? 'images/pause.png' : 'images/play.png',
    down: 'images/next.png',
    backgroundColor: '#ffffff'
};

module.exports.screen = function() {
    var screen = new UI.Window({
        fullscreen: true,
        action: module.exports.actionDef
    });

    var bg = new UI.Rect({
        position: new V(0, 0),
        size: new V(144, 168),
        backgroundColor: '#00aaff'
    });

    screen.add(bg);

    return screen;
};

module.exports.title = function(text) {
    if (module.exports.DEMO_MODE) {
        text = demoProps.song;
    }
    return new UI.Text({
        textAlign: 'left',
        position: new V(8, 8 + (Settings.option('showClock') === true ? 6 : 0)),
        size: new V(100, 83),
        font: 'gothic-28',
        color: '#ffffff',
        text: text || ''
    });
};

module.exports.description = function(text) {
    if (module.exports.DEMO_MODE) {
        text = demoProps.artist.toUpperCase() + '\n' + demoProps.album;
    }
    return new UI.Text({
        textAlign: 'left',
        position: new V(8, 104),
        size: new V(100, 53),
        font: 'gothic-18',
        color: '#ffffff',
        text: text || ''
    });
};


module.exports.time = function() {
    return new UI.TimeText({
        textAlign: 'center',
        position: new V(0, 0),
        size: new V(144, 14),
        font: 'gothic-14',
        color: '#ffffff',
        text: Settings.option('showClock') === true ? '%H:%M' : ''
    });
};


