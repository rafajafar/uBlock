/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2015 Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/******************************************************************************/

(function() {

'use strict';

/******************************************************************************/

// This can happen
if ( typeof vAPI !== 'object' || vAPI.loadLargeMediaInteractive === true ) {
    return;
}

/******************************************************************************/

var largeMediaElementAttribute = 'data-' + vAPI.sessionId;
var largeMediaElementSelector =
    ':root audio[' + largeMediaElementAttribute + '],\n' +
    ':root   img[' + largeMediaElementAttribute + '],\n' +
    ':root video[' + largeMediaElementAttribute + ']';

/******************************************************************************/

var mediaNotLoaded = function(elem) {
    var src = elem.getAttribute('src') || '';
    if ( src === '' ) {
        return false;
    }
    switch ( elem.localName ) {
    case 'audio':
    case 'video':
        return elem.error !== null;
    case 'img':
        if ( elem.naturalWidth === 0 && elem.naturalHeight === 0 ) {
            return window.getComputedStyle(elem)
                         .getPropertyValue('display') !== 'none';
        }
        break;
    default:
        break;
    }
    return false;
};

/******************************************************************************/

// For all media resources which have failed to load, trigger a reload.

// <audio> and <video> elements.
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement

var surveyMissingMediaElements = function() {
    var largeMediaElementCount = 0;
    var elems = document.querySelectorAll('audio,img,video');
    var i = elems.length, elem;
    while ( i-- ) {
        elem = elems[i];
        if ( mediaNotLoaded(elem) ) {
            elem.setAttribute(largeMediaElementAttribute, '');
            largeMediaElementCount += 1;
        }
    }
    return largeMediaElementCount;
};

if ( surveyMissingMediaElements() === 0 ) {
    return;
}

vAPI.loadLargeMediaInteractive = true;

// Insert custom style tag.
var styleTag = document.createElement('style');
styleTag.setAttribute('type', 'text/css');
styleTag.textContent = [
    largeMediaElementSelector + ' {',
        'border: 1px dotted red !important;',
        'box-sizing: border-box !important;',
        'cursor: zoom-in !important;',
        'display: inline-block;',
        'font-size: 1em !important;',
        'min-height: 1em !important;',
        'min-width: 1em !important;',
    '}'
].join('\n');
document.head.appendChild(styleTag);

/******************************************************************************/

var messager = vAPI.messaging.channel('scriptlets');

/******************************************************************************/

var stayOrLeave = (function() {
    var timer = null;

    var timeoutHandler = function(leaveNow) {
        timer = null;
        if ( leaveNow !== true ) {
            if ( 
                document.querySelector(largeMediaElementSelector) !== null ||
                surveyMissingMediaElements() !== 0
            ) {
                return;
            }
        }
        // Leave
        if ( styleTag !== null ) {
            styleTag.parentNode.removeChild(styleTag);
            styleTag = null;
        }
        vAPI.loadLargeMediaInteractive = false;
        document.removeEventListener('error', onLoadError, true);
        document.removeEventListener('click', onMouseClick, true);
        if ( messager !== null ) {
            messager.close();
            messager = null;
        }
    };

    return function(leaveNow) {
        if ( timer !== null ) {
            clearTimeout(timer);
        }
        if ( leaveNow ) {
            timeoutHandler(true);
        } else {
            timer = vAPI.setTimeout(timeoutHandler, 5000);
        }
    };
})();

/******************************************************************************/

var onMouseClick = function(ev) {
    if ( ev.button !== 0 ) {
        return;
    }

    var elem = ev.target;
    if ( elem.matches(largeMediaElementSelector) === false ) {
        return;
    }

    if ( mediaNotLoaded(elem) === false ) {
        elem.removeAttribute(largeMediaElementAttribute);
        stayOrLeave();
        return;
    }

    var src = elem.getAttribute('src');
    elem.removeAttribute('src');

    var onLargeMediaElementAllowed = function() {
        elem.setAttribute('src', src);
        elem.removeAttribute(largeMediaElementAttribute);
        stayOrLeave();
    };

    messager.send({
        what: 'temporarilyAllowLargeMediaElement'
    }, onLargeMediaElementAllowed);

    ev.preventDefault();
    ev.stopPropagation();
};

document.addEventListener('click', onMouseClick, true);

/******************************************************************************/

var onLoad = function(ev) {
    var elem = ev.target;
    if ( elem.hasAttribute(largeMediaElementAttribute) ) {
        elem.removeAttribute(largeMediaElementAttribute);
        stayOrLeave();
    }
};

document.addEventListener('load', onLoad, true);

/******************************************************************************/

var onLoadError = function(ev) {
    var elem = ev.target;
    if ( mediaNotLoaded(elem) ) {
        elem.setAttribute(largeMediaElementAttribute, '');
    }
};

document.addEventListener('error', onLoadError, true);

/******************************************************************************/

vAPI.shutdown.add(function() {
    stayOrLeave(true);
});

/******************************************************************************/

})();

/******************************************************************************/
