function LocalVideo(display){
    this._init.apply(this, arguments);
}

LocalVideo.prototype = {

    _init: function(display){
        this.display = display;

        this.stream = new Promise(function(resolve, reject){
            navigator.getUserMedia({ video: true, audio: true }, resolve, reject);
        })
        .then(this._success.bind(this))
        .catch(this._fail.bind(this));
    },


    _fail: function(err){
        $(document).trigger('LocalVideo:Error', err);
    },


    _success: function(stream){
        this.display.setAttribute('src', window.URL.createObjectURL(stream));

        return stream;
    }

};
