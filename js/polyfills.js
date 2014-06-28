navigator.getUserMedia = ( navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mozGetUserMedia ||
                           navigator.msGetUserMedia);

window.URL = (window.URL || window.webkitURL);

window.requestAnimationFrame = (function() {
    return window.requestAnimationFrame ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame ||
           window.msRequestAnimationFrame ||
           window.oRequestAnimationFrame ||
           function(f) { return window.setTimeout(f, 1000 / 60); };
}());

window.cancelAnimationFrame = (function() {
    return window.cancelAnimationFrame ||
           window.cancelRequestAnimationFrame ||
           window.webkitCancelAnimationFrame ||
           window.webkitCancelRequestAnimationFrame ||
           window.mozCancelAnimationFrame ||
           window.mozCancelRequestAnimationFrame ||
           window.msCancelAnimationFrame ||
           window.msCancelRequestAnimationFrame ||
           window.oCancelAnimationFrame ||
           window.oCancelRequestAnimationFrame ||
           function(id) { window.clearTimeout(id); };
}());

window.SpeechRecognition = ( window.SpeechRecognition ||
                             window.webkitSpeechRecognition ||
                             window.mozSpeechRecognition ||
                             window.msSpeechRecognition);

if (!Array.from) {
    Array.from = function( arrayLikeObject ) {
        return Array.prototype.slice.call( arrayLikeObject );
    };
}
