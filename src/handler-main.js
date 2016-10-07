/* global module */
/* jshint browser:true */

var Vibe = require('ui/vibe');
var Settings = require('settings');

var api = require('./api');
var mixpanel = require('./mixpanel');
var mainUiComponents = require('./screen-main');

var volume = 0;
var playerid = 0;
var playertype;
var playState = 0;
var errors = 0;
var menuMode = 'menu';
var networkSuccessTracked = false;

var titleUi;
var descriptionUi;
var timeUi;
var mainScreen;
var retryTimeout;
var onErrorCallback = function() {};
var currHostIndex = Settings.data('activeHostIndex');
var nextHostIndex = Settings.data('activeHostIndex') + 1;
var numHosts = Settings.option('hosts').length - 1
var shakes = 0;

function toggleHost(event){
	//var numHosts = Settings.option('hosts').length - 1
 	nextHostIndex++;
	if (nextHostIndex > numHosts )
	{
		nextHostIndex = 0;
	}    

	var newHost = Settings.option('hosts')[nextHostIndex];
    Settings.data('activeHost', newHost);
    Settings.data('activeHostIndex', nextHostIndex);
	Vibe.vibrate('double');
    module.exports.reset();
    module.exports.updatePlayerState();
}

function clearUi() {
    titleUi.remove();
    descriptionUi.remove();
    timeUi.remove();
}

function addUi() {
    mainScreen.add(titleUi = mainUiComponents.title());
    mainScreen.add(descriptionUi = mainUiComponents.description());
    mainScreen.add(timeUi = mainUiComponents.time());
    updateText('Trying to connect...', 'Hang on for just a second.');
}

function updateText(title, desc) {
    titleUi.text(title);
    descriptionUi.text(desc);
}

function onNetworkError(error) {
    errors++;
    if (errors < 4) {
        clearTimeout(retryTimeout);
        retryTimeout = setTimeout(module.exports.updatePlayerState, 1000);
        console.log('Error, retrying in ' + (1000) + ' ms');
    } else {
        console.log('Error limit reached. ' + JSON.stringify(error));
        updateText('Can\'t connect to Kodi', 'Ensure Kodi\'s IP is accessible from your phone.');
        onErrorCallback(error);
    }
}

function onNetworkSuccess() {
    if (!networkSuccessTracked) {
        networkSuccessTracked = true;
        require('./mixpanel').track('Network success');
    }
}

function updateActionBar(field, value) {
    var actionDef = mainUiComponents.actionDef;
    if (menuMode === 'player') {
        if (playState > 1) {
            actionDef.select = 'images/pause.png';
        } else {
            actionDef.select = 'images/play.png';
        }
        actionDef.up = 'images/volume_up.png';
        actionDef.down = 'images/volume_down.png';
    } else if (menuMode === 'skipper') {
        actionDef.up = 'images/fr.png';
        if (playState > 0) {
            actionDef.select = 'images/stop.png';
        } else {
            actionDef.select = 'images/play.png';
        }
        actionDef.down = 'images/ff.png';
    } else if (menuMode === 'menu') {
        actionDef.up = 'images/up.png';
        actionDef.select = 'images/check.png';
        actionDef.down = 'images/down.png';
    }
    if (field && value) {
        actionDef[field] = value;
    }
    mainScreen.action(actionDef);
}

var clicks = 0;
function handleClick(singleCallback, doubleCallback) {
    clicks++;
    if (clicks == 1) {
        setTimeout(function() {
            console.log('click handler ' + clicks);
            if(clicks == 1) {
                (singleCallback || function() {})();
            } else {
                (doubleCallback || function() {})();
            }
            clicks = 0;
        }, 600);
    }
}

function clickStop() {
    api.send('Player.Stop', [playerid], module.exports.updatePlayerState);
    
    // make sure we update display after this stop action as Kodi player state sometimes updates a bit late
    setTimeout(module.exports.updatePlayerState, 800);
    setTimeout(module.exports.updatePlayerState, 1600);

    mixpanel.track('Button pressed, Stop', {
        playerType: playertype
    });
}

function clickPlayPause() {
    function onSuccessfulPlay() {
        module.exports.updatePlayerState();
        // make sure we update display after this initial playing action as callback is earlier than playing state
        setTimeout(module.exports.updatePlayerState, 800);
        setTimeout(module.exports.updatePlayerState, 1600);
        setTimeout(module.exports.updatePlayerState, 3200);
        setTimeout(module.exports.updatePlayerState, 5000);
    }

    if (playState > 0) {
        api.send('Player.PlayPause', [playerid, 'toggle'], module.exports.updatePlayerState);
    } else {
        switch (Settings.option('playActionWhenStopped')) {
            case 'playLast':
                api.send('Input.ExecuteAction', {'action': 'play'}, onSuccessfulPlay, onNetworkError);  
                break;
            case 'partymode':
                /*falls through*/
            default:
                api.send('Player.SetPartymode', [0, 'toggle'], onSuccessfulPlay, onNetworkError);
                break;
        }
    }
    mixpanel.track('Button pressed, PlayPause', {
        playState: playState,
        playerType: playertype
    });
}

function clickFunctionSelector() {
    if (menuMode === 'menu' && Settings.option('hosts') && Settings.option('hosts').length > 1) {
        require('./screen-func-selector').screen().show();
    } else {
        switch (menuMode) {
            default:
            case 'player':
                if (playState > 0) {
                    module.exports.setMenuMode('skipper');                    
                } else {
                    module.exports.setMenuMode('menu');                    
                }
                break;
            case 'skipper':
                module.exports.setMenuMode('menu');
                break;
            case 'menu':
                module.exports.setMenuMode('player');
                break;
        }
    }

    mixpanel.track('Button pressed, Function Selector');
}

function clickSkipNext() {
    updateActionBar('down', 'images/next.png');

    setTimeout(function() {
        updateActionBar('down', 'images/volume_down.png');
    }, 1000);

    api.send('Player.GoTo', [playerid, 'next'], module.exports.updatePlayerState);

    mixpanel.track('Button pressed, Next', {
        playerType: playertype
    });
}

function clickSkipPrev() {
    updateActionBar('up', 'images/previous.png');

    setTimeout(function() {
        updateActionBar('up', 'images/volume_up.png');
    }, 1000);

    api.send('Player.GoTo', [playerid, 'previous'], module.exports.updatePlayerState);

    mixpanel.track('Button pressed, Previous', {
        playerType: playertype
    });
}

function clickSkipBack() {
    api.send('Input.ExecuteAction', {action: 'stepback'}, module.exports.updatePlayerState);

    mixpanel.track('Button pressed, Skip back', {
        playerType: playertype
    });
}

function clickSkipAhead() {
    api.send('Input.ExecuteAction', {action: 'stepforward'}, module.exports.updatePlayerState);

    mixpanel.track('Button pressed, Skip ahead', {
        playerType: playertype
    });
}


function clickBigSkipBack() {
    api.send('Input.ExecuteAction', {action: 'bigstepback'}, module.exports.updatePlayerState);

    mixpanel.track('Button pressed, Skip back', {
        playerType: playertype
    });
}

function clickBigSkipAhead() {
    api.send('Input.ExecuteAction', {action: 'bigstepforward'}, module.exports.updatePlayerState);

    mixpanel.track('Button pressed, Skip ahead', {
        playerType: playertype
    });
}


function clickVolumeUp() {
    var oldVolume = volume;
    volume += 4;
    volume = Math.min(volume, 100);
    api.send('Application.SetVolume', [volume], function(data) {
        volume = data.result;
        module.exports.updatePlayerState();
    }, onNetworkError);

    mainUiComponents.setVolume(oldVolume, volume);

    mixpanel.track('Button pressed, Volume up', {
        volume: volume,
        oldVolume: oldVolume,
        playerType: playertype
    });
}

function clickVolumeDown() {
    var oldVolume = volume;
    volume -= 5;
    volume = Math.max(volume, 0);
    api.send('Application.SetVolume', [volume], function(data) {
        volume = data.result;
        module.exports.updatePlayerState();
    }, onNetworkError);

    mainUiComponents.setVolume(oldVolume, volume);

    mixpanel.track('Button pressed, Volume down', {
        volume: volume,
        oldVolume: oldVolume,
        playerType: playertype
    });
}

function clickMenuSelect() {
    api.send('Input.Select', []);

    mixpanel.track('Button pressed, Menu select', {
        playerType: playertype,
        playState: playState
    });
}

function clickMenuBack() {
    updateActionBar('select', 'images/back.png');

    setTimeout(function() {
        updateActionBar('select', 'images/check.png');
    }, 1000);

    api.send('Input.Back', []);

    mixpanel.track('Button pressed, Menu back', {
        playerType: playertype,
        playState: playState
    });
}

function clickMenuUp() {
    api.send('Input.Up', []);

    mixpanel.track('Button pressed, Menu up', {
        playerType: playertype,
        playState: playState
    });
}

function clickMenuDown() {
    api.send('Input.Down', []);

    mixpanel.track('Button pressed, Menu down', {
        playerType: playertype,
        playState: playState
    });
}

function clickMenuLeft() {
    updateActionBar('up', 'images/left.png');

    setTimeout(function() {
        updateActionBar('up', 'images/up.png');
    }, 1000);

    api.send('Input.Left', []);

    mixpanel.track('Button pressed, Menu left', {
        playerType: playertype,
        playState: playState
    });
}

function clickMenuRight() {
    updateActionBar('down', 'images/right.png');

    setTimeout(function() {
        updateActionBar('down', 'images/down.png');
    }, 1000);

    api.send('Input.Right', []);

    mixpanel.track('Button pressed, Menu right', {
        playerType: playertype,
        playState: playState
    });
}

function setupEventListeners() {
    mainScreen.on('click', 'select', function(e) {
        if (menuMode === 'player') {
            clickPlayPause();
        } else if (menuMode === 'skipper') {
            if (playState > 0) {
                clickStop();
            } else {
                clickPlayPause();
            }
        } else if (menuMode === 'menu') {
            handleClick(clickMenuSelect, clickMenuBack);
        }
    });

    mainScreen.on('longClick', 'select', function(e) {
        if (Settings.option('vibeOnLongPress') !== false) {
            Vibe.vibrate('short');
        }
        clickFunctionSelector();
    });

    mainScreen.on('click', 'up', function(e) {
        if (menuMode === 'player') {
            clickVolumeUp();
        } else if (menuMode === 'skipper') {
            clickSkipBack();
        } else if (menuMode === 'menu') {
            clickMenuUp();
        }
    });

    mainScreen.on('click', 'down', function(e) {
        if (menuMode === 'player') {
            clickVolumeDown();
        } else if (menuMode === 'skipper') {
            clickSkipAhead();
        } else if (menuMode === 'menu') {
            clickMenuDown();
        }
    });
    
    mainScreen.on('longClick', 'up', function(e) {
        if (Settings.option('vibeOnLongPress') !== false) {
            Vibe.vibrate('short');
        }
        if (menuMode === 'player') {
            clickSkipPrev();
        } else if (menuMode === 'skipper') {
            clickBigSkipBack();
        } else if (menuMode === 'menu') {
            clickMenuLeft();
        }
    });

    mainScreen.on('longClick', 'down', function(e) {
        if (Settings.option('vibeOnLongPress') !== false) {
            Vibe.vibrate('short');
        }
        if (menuMode === 'player') {
            clickSkipNext();
        } else if (menuMode === 'skipper') {
            clickBigSkipAhead();
        } else if (menuMode === 'menu') {
            clickMenuRight();
        }
    });
    
    mainScreen.on('click', 'back', function(event) {
        if (menuMode === 'player') {
            mainScreen.hide();
        } else if (menuMode === 'skipper') {
            module.exports.setMenuMode('player');
        } else if (menuMode === 'menu') {
            module.exports.setMenuMode('player');
        }
    });

    //mainScreen.on('accelTap', module.exports.updatePlayerState);
	mainScreen.on('accelTap', function(e){
		shakes++;
		if(shakes == 1)
		{
			setTimeout(function() {
    	    	if(shakes >1) {
					toggleHost();
    	    	} 
    	    	shakes = 0;
    	    }, 700);
		}
	});

    mainScreen.on('hide', function() {
        var windowStack = require('ui/windowstack');
        var length = 0;
        windowStack.each(function(wind, i) {
            length++;
        });
        if (length === 0) {
            mixpanel.track('App closed', {
                lastScreen: 'main',
                volume: volume,
                playState: playState,
                playerType: playertype
            });
        }
    });
}

module.exports.setMenuMode = function(newMode) {
    menuMode = newMode;
    updateActionBar();
    
    mixpanel.track('Set menu mode', {
        volume: volume,
        playState: playState,
        playerType: playertype,
        menuMode: menuMode
    });
};

module.exports.getPlayerType = function() {
    return playertype;
};

module.exports.updatePlayerState = function() {
    if (!Settings.data('activeHost')) {
        updateText('No IP set', 'Please open the settings app on your phone.');
        return;
    }

    api.send('Application.GetProperties', [['volume', 'muted']], function onSuccess(data) {
        errors = 0;
        volume = data.result.volume;

        onNetworkSuccess();

        api.send('Player.GetActivePlayers', [], function(data) {
            if (data.result.length > 0) {
                playerid = data.result[0].playerid;
                playertype = data.result[0].type;

                api.send('Player.GetProperties', [playerid, ['percentage', 'speed']], function(data) {
                    if (data.result.speed > 0) {
                        playState = 2;
                    } else {
                        playState = 1;
                    }
                    updateActionBar();
                });

                api.send('Player.GetItem', {'properties': ['title', 'album', 'artist', 'duration', 'runtime', 'showtitle'], 'playerid': playerid}, function(data) {
                    var playingItem = data.result.item;
                    if (playertype === 'audio') {
                        var artist = playingItem && playingItem.artist && playingItem.artist[0] || '';
                        updateText(playingItem && playingItem.title || '', artist.toUpperCase() + '\n' + (playingItem && playingItem.album || ''));
                    } else if (playertype === 'video') {
                        updateText(playingItem.title || '', playingItem.showtitle || '');
                    }
                });
            } else {
                playState = 0;
                playertype = undefined;
                updateText('Nothing playing', 'Press play to ' + (Settings.option('playActionWhenStopped') === 'playLast' ? 'start the last active playlist' : 'start the party'));
                updateActionBar();
            }
            onNetworkSuccess();
        });
    },  onNetworkError);

};

module.exports.reset = function() {
    errors = 0;
    clearUi();
    addUi();
};

module.exports.init = function(m, errorCallback) {
    onErrorCallback = errorCallback || onErrorCallback;
    mainScreen = m;
    addUi();
    module.exports.updatePlayerState();

    setupEventListeners();
};
