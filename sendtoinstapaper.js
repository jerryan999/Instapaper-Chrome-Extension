/**
 *  SendToInstapaper
 */
var SendToInstapaper = ( function() {
    var URL_AUTH    =   "https://www.instapaper.com/api/authenticate",
        URL_ADD     =   "https://www.instapaper.com/api/add",

        STATUS_OK           =   200,
        STATUS_CREATED      =   201,
        STATUS_BADREQUEST   =   400,
        STATUS_FORBIDDEN    =   403,
        STATUS_ERROR        =   500;

    function syncRequest( options ) {
        options.method = options.method || "GET";
        options.async  = false;
        var xhr         = new XMLHttpRequest(),
            postData    = "";
        xhr.open(
            options.method, options.url, options.async
        );
        if ( options.username || options.password ) {
            xhr.setRequestHeader( "Authorization", "Basic " + btoa( options.username + ":" + options.password ) );
        }
        if ( options.method === "POST" ) {
            xhr.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded' );
        }
        console.log( "XHR: %o", options, xhr );
        try {
            if ( options.data ) {
                for ( key in options.data ) {
                    if ( options.data.hasOwnProperty( key ) ) {
                        postData += encodeURIComponent( key ) + "=" + encodeURIComponent( options.data[ key ] ) + "&";
                    }
                }
                postData += "1=1";
            }
            xhr.send( postData );
            return xhr;
        } catch ( e ) {
            return {
                'status':       0,
                'exception':    e
            };
        }
    } 

    function isAuthenticated( force ) {
        console.log( "Checking auth: %o", option( 'authenticated' ) );
        if ( option( 'authenticated' ) !== STATUS_ERROR && !force ) {
            return option( 'authenticated' );
        }

        option( 'authenticated', null );
        if (
            option( "username" ) !== undefined &&
            option( "password" ) !== undefined
        ) {
            var req = syncRequest( {
                'url':      URL_AUTH,
                'username': option( "username" ),
                'password': option( "password" )
            } );
            switch ( req.status ) {
                case STATUS_OK:
                    option( "authenticated",    true );
                    break;
                case STATUS_FORBIDDEN:
                    option( "authenticated",    false );
                    break;
                case STATUS_ERROR:
                default:
                    option( "authenticated",    STATUS_ERROR );
                    break;
            }
        }
        return localStorage.authenticated;
    }

    function sendURL( tab ) {
        animatedIcon.start( tab.id );

        if ( isAuthenticated() ) {
            return syncRequest( {
                'method':   "POST",
                'url':      URL_ADD,
                'username': option( "username" ),
                'password': option( "password" ),
                'data':     {
                    'url':      tab.url,
                    'title':    tab.title
                }  
            } );
        } else {
            return {
                "status":   STATUS_ERROR
            };
        }
    }

    function backgroundInit() {
        option( 'currentTab', null );
        // When Chrome displays any tab, show the pageAction
        // icon in that tab's addressbar.
        var handleTabEvents = function(tabId) {
            option( 'currentTab', tabId );

            chrome.pageAction.show( tabId );
            setPopup();
        };
        chrome.tabs.onSelectionChanged.addListener( handleTabEvents );
        chrome.tabs.onUpdated.addListener( handleTabEvents );

        // Display the pageAction icon for the current tab
        // (as it's already visible, `onSelectionChange`
        // won't have been called.
        chrome.tabs.getSelected( null, function( tab ) {
            option( 'currentTab', tab.id );
            chrome.pageAction.show( tab.id );
            setPopup();
        } );

        chrome.pageAction.onClicked.addListener( function ( tab ) {
            var response = sendURL( tab );
            animatedIcon.stop();
            switch ( response.status ) {
                case STATUS_CREATED:
                    chrome.pageAction.setIcon( {
                        "tabId":    tab.id,
                        "path":     "success.png"
                    } );
                    break;
                case STATUS_BADREQUEST:
                case STATUS_ERROR:
                case STATUS_FORBIDDEN:
                default:
                    chrome.pageAction.setIcon( {
                        "tabId":    tab.id,
                        "path":     "failure.png"
                    } );
                    break;
            }
        } );

    }

    function setPopup( ) {
        if ( isAuthenticated() !== true ) {
            console.log( "Setting popup." );
            chrome.pageAction.setPopup( {
                'tabId':    option( 'currentTab' ),
                'popup':    'setup.html'
            } );
        } else {
            console.log( "Unsetting popup." );
            chrome.pageAction.setPopup( {
                'tabId':    option( 'currentTab' ),
                'popup':    ''
            } );
        }
    }

    function setupInit() {
        var theForm = document.getElementById( 'optionForm' ),
            user    = document.getElementById( 'username' ),
            pass    = document.getElementById( 'password' ),
            auth;

        user.value = option( 'username' );
        pass.value = option( 'password' );

        theForm.addEventListener( 'submit', function ( e ) {
            option( 'username', user.value );
            option( 'password', pass.value );
            auth = isAuthenticated( true );
            if ( auth === true ) {
                theForm.appendChild( document.createTextNode( "Success!" ) );
            } else if ( auth === false ) {
                theForm.appendChild( document.createTextNode( "Invalid username/password." ) );
            } else if ( auth === STATUS_ERROR ) {
                theForm.appendChild( document.createTextNode( "Error communicating with Instapaper.  Are you online?" ) );
            }

            setPopup();

            e.preventDefault(); e.stopPropagation();
            return false;
        } );
    }

    function option( key, value ) {
        if ( typeof( value ) !== "undefined" ) {
            localStorage[ key ] = JSON.stringify( { "value": value } );
        } else {
            if ( typeof( localStorage[ key ] ) !== "undefined" ) {
                return JSON.parse( localStorage[ key ] ).value;
            } else {
                return undefined;
            }
        }
    }

/**************************************************************************
 * Icon Animation
 */
    var animatedIcon = ( function() {
        var iconAnimationInterval   = null,
            canvas                  = null,
            context                 = null
            iconAnimationState      = 0;

        function startIconAnimation( tabId ) {
            if ( ! canvas ) {
                canvas   =   document.getElementById( 'canvas' );
                context  =   canvas.getContext('2d');
            }
            if ( ! tabId ) {
                return;
            }
            iconAnimationInterval = window.setInterval( function () {
                console.log( "Animating %d", iconAnimationState );
                chrome.pageAction.setIcon( {
                    "tabId":        tabId,
                    "imageData":    drawIcon( iconAnimationState )
                } );
                iconAnimationState++;
            }, 25 );
        }
            function drawIcon( state ) {
                var MAXANGLE        =   Math.PI * 4 / 2,
                    NUM_IN_CYCLE    =   75,
                    INTERVAL        =   MAXANGLE / NUM_IN_CYCLE;

                context.clearRect(0, 0, 19, 19);
                var x           = 9,
                    y           = 9,
                    radius      = 5,
                    startAngle, endAngle;

                if ( Math.floor( state / NUM_IN_CYCLE ) % 2 ) {
                    startAngle  = 0,
                    endAngle    = ( INTERVAL * state ) % MAXANGLE;
                } else {
                    startAngle  = ( INTERVAL * state ) % MAXANGLE;
                    endAngle    = 0;
                }

                context.beginPath();
                context.arc( x, y, radius, startAngle, endAngle, false );
                context.stroke();
                
                return context.getImageData(0, 0, 19, 19);
            }
        function stopIconAnimation() {
            clearInterval( iconAnimationInterval );
            iconAnimationInterval = null;
        }

        return {
            "start":    startIconAnimation,
            "stop":     stopIconAnimation
        };
    }() );

    return {
        'backgroundInit':   backgroundInit,
        'setupInit':        setupInit,
        'option':           option
    };
}() );
