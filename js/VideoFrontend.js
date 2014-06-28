/**
 * video 要素の画像を処理して canvas 要素で表示する
 */
function VideoFrontend(source, display, workspace){
    this._init.apply(this, arguments);
}

VideoFrontend.prototype = {

    /**
     * 表示元 video 要素
     */
    source: null,


    /**
     * 表示先 canvas 要素
     */
    display: null,


    /**
     * headtracker が使用する処理用 canvas
     */
    workspace: null,


    _init: function(source, display, workspace){
        this.source = source;
        this.display = display;
        this.workspace = workspace;
        this._dspCtx = this.display.getContext('2d');

        var width = this.display.width;
        var height = this.display.height;

        this.width = width;
        this.height = height;
        this.source.width = width;
        this.source.height = height;
        this.workspace.width = width;
        this.workspace.height = height;

        this.face = {
            x: width / 2,
            y: height / 2,
            height: 300,
            width: 150
        };

        this.msgBox = $('#messageBalloonContent')[0];
        this.detectingFaceNotice = $('.top-center').notify({
            type: 'info',
            message: { text: '顔認識中...' },
            closable: false,
            fadeOut: { enabled: false }
        });
    },


    stop: function(){
        if(this._balloonTimer){
            clearTimeout(this._balloonTimer);
        }

        document.removeEventListener('facetrackingEvent', this, false);
        document.removeEventListener('headtrackrStatus', this, false);

        this._tracker.stop();
        this._clearBalloon();
        this.detectingFaceNotice.hide();

        window.URL.revokeObjectURL(this.source.src);
        this.source.removeAttribute('src');
        this._dspCtx.clearRect(0, 0, this.width, this.height);

        delete this._tracker;
    },


    handleEvent: function(event){
        switch(event.type){
            case 'facetrackingEvent':
                this._updateFacePosition(event);
                break;

            case 'headtrackrStatus':
                this._updateFaceDetectionStatus(event);
                break;
        }
    },


    initStream: function(stream){
        this.source.setAttribute('src', window.URL.createObjectURL(stream));

        this._tracker = new headtrackr.Tracker({
            ui: false,
            smoothing: false,
            detectionInterval: 80
        });

        this._tracker.init(this.source, this.workspace, false);
        this._tracker.start();

        document.addEventListener('facetrackingEvent', this, false);
        document.addEventListener('headtrackrStatus', this, false);

        this.draw();
    },


    draw: function(){
        try{
            this._dspCtx.drawImage(this.source, 0, 0, this.width, this.height);
        }catch(ex){}

        if(this._msg){
            this._drawBalloonNextToFace();
        }

        requestAnimationFrame(this.draw.bind(this));
    },


    drawBalloon: function(msg, duration){
        if(this._balloonTimer){
            clearTimeout(this._balloonTimer);
        }

        this._msg = msg;
        this._balloonTimer = setTimeout(this._clearBalloon.bind(this), duration || 5000);
    },


    _clearBalloon: function(){
        this._msg = '';
        this.msgBox.textContent = '';
        this._detectedFace = false;
        this._balloonTimer = null;
    },


    _updateFacePosition: function(ev){
        this.face.x = ev.x;
        this.face.y = ev.y;
        this.face.width = ev.width;
        this.face.height = ev.height;
    },


    _updateFaceDetectionStatus: function(ev){
        switch(ev.status){
            case 'whitebalance':
            case 'detecting':
            case 'redetecting':
                this.detectingFaceNotice.show();
                break;

            case 'found':
                this.detectingFaceNotice.hide();
                break;

            case 'lost':
                $('.top-center').notify({
                    type: 'danger',
                    message: { text: '顔認識に失敗しました.'},
                }).show();
                break;
        }
    },


    _drawBalloonNextToFace: function(){
        //顔の位置と左右にどれくらいの余裕があるかを計算する
        var leftPadding = this.face.x - (this.face.width >> 1);
        var rightPadding = this.width - (leftPadding + this.face.width);
        var drawOnLeft = leftPadding > rightPadding;


        //テキストを表示する
        this.msgBox.textContent = this._msg;


        //位置を計算する
        var width, height, centerY, x, y, rotate;

        if(drawOnLeft){
            height = this.msgBox.offsetHeight;
            width = this.msgBox.offsetWidth;
            x = this.face.x - (this.face.width >> 1) - width - 20;
            centerY = this.face.y - 50;
            y = centerY - (height >> 1);
            rotate = 330;
        }else{
            height = this.msgBox.offsetHeight;
            width = this.msgBox.offsetWidth;
            x = this.face.x + (this.face.width) + 20;
            centerY = this.face.y - 50;
            y = centerY - (height >> 1);
            rotate = 230;
        }


        this.msgBox.setAttribute('style', 'top:' + y + 'px;' +
                                          'left:' + x + 'px;');


        //吹き出しを表示する
        this._dspCtx.beginPath();
        tkuri.cv.drawBalloonPath(this._dspCtx,
                                 x, y,
                                 width + 20, height,
                                 10, 0.25, rotate, 0.2);

        this._dspCtx.fillStyle = '#ffffff';
        this._dspCtx.fill();
    },

};
