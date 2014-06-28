function MMDFrontend(){
    this._init.apply(this, arguments);
}

MMDFrontend.prototype = {

    _init: function(display){
        this._display = display;
        this.width = display.width;
        this.height = display.height;

        this._msgBox = $('#messageBalloonContent')[0];
        this._msgBox.classList.add('mmdMessageBalloon');

        this._msgContent = document.createElement('div');
        this._msgBox.appendChild(this._msgContent);

        this.loadingModelNotice = $('.top-center').notify({
            type: 'info',
            message: { text: '読み込み中...' },
            closable: false,
            fadeOut: { enabled: false }
        });


        this._mmd = new MMD(display, display.width, display.height);
        this._mmd.initShaders();
        this._mmd.initParameters();
        this._mmd.registerMouseListener(display);

        this.setAvatar('Claudia.pmd');
    },


    stop: function(){
        if(this._balloonTimer){
            clearTimeout(this._balloonTimer);
        }

        this.loadingModelNotice.hide();
        this._clearBalloon();

        this._msgBox.classList.remove('mmdMessageBalloon');
        this._msgBox.removeChild(this._msgContent);

        delete this._mmd;
        delete this._model;
        delete this.motion;
    },


    setAvatar: function(avatarName){
        this.loadingModelNotice.show();

        this._model = new MMD.Model('model', avatarName);

        this._model.load(function(){
            this._mmd.addModel(this._model);
            this._mmd.initBuffers();
            this._mmd.start();

            this.setMotion('motion/stand2.vmd', true);
        }.bind(this));
    },


    setMotion: function(motionName, loopFlag){
        this._motion = new MMD.Motion(motionName);

        this._motion.load(function(){
            this._mmd.addModelMotion(this._model, this._motion, false, 0, loopFlag);
            this._mmd.play();

            this.loadingModelNotice.hide();
        }.bind(this));
    },


    drawBalloon: function(msg, duration){
        if(this._balloonTimer){
            clearTimeout(this._balloonTimer);
        }

        this._msgContent.textContent = msg;
        $(this._msgBox).show();
        this._balloonTimer = setTimeout(this._clearBalloon.bind(this), duration || 5000);
    },


    _clearBalloon: function(){
        $(this._msgBox).hide();
    },


};
