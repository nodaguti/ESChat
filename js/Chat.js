function Chat(){
    this._init.apply(this, arguments);
}

Chat.prototype = {

    inputbox: null,

    historybox: null,


    _init: function(args){
        this.inputbox = args.inputbox;
        this.historybox = args.historybox;
    },


    /**
     * チャットを開始する
     */
    start: function(args){
        this._fileConnection = args.fileConnection;
        this._localID = args.localID;
        this._remoteID = args.remoteID;


        this.inputbox.querySelector('.btn-submit').addEventListener('click', function(ev){
            this.sendMessage(this.inputbox.querySelector('input[type="text"]').value, true);
        }.bind(this), false);

        this.inputbox.querySelector('input[type="text"]').addEventListener('keydown', function(ev){
            if((ev.keyCode || ev.charCode) !== 13) return;
            this.sendMessage(ev.target.value, true);
        }.bind(this), false);


        this._initSpeechRecognition();
        this._initDropbox();
    },


    /**
     * チャットが終了した時に呼ばれる
     */
    stop: function(){
        if(this._speech){
            clearInterval(this._speechResumeTimer);
            this._speech.stop();
        }
    },



    /****************
    /* ファイル送受信
    /****************/

    /**
     * ファイル送信のイベントを初期化する
     */
    _initDropbox: function(){
        var modal = $('#dialog-upload');

        $(document).on('dragenter dragover dragend dragleave', function(event){
            event.preventDefault();
        });

        $(document).on('drop', function(event){
            event.preventDefault();
            modal.modal('hide');
            this._uploadFiles(event.originalEvent.dataTransfer.files);
        }.bind(this));

        modal.find('.btn-upload').on('click', function(event){
            event.preventDefault();
            modal.find('.dialog-upload-file-input').click();
        });

        modal.find('.dialog-upload-file-input').on('change', function(event){
            modal.modal('hide');
            this._uploadFiles(event.target.files);
        }.bind(this));

        //ファイルアップロードボタン
        $('#toolbox-container > .btn-upload').on('click', function(){
            $('#dialog-upload').modal('show');
        });


        this._fileConnection.on('started', this._startedSendingFile.bind(this));
        this._fileConnection.on('cancelled', this._cancelledSendingFile.bind(this));
        this._fileConnection.on('finished', this._finishedSendingFile.bind(this));
        this._fileConnection.on('requested', this._requestedFile.bind(this));
        this._fileConnection.on('received', this._receivedFile.bind(this));
    },


    /**
     * 処理中の送信/受信ファイル
     */
    _fileTransfers: {},


    /**
     * ファイルを送信する
     */
    _uploadFiles: function(fileList){
        this._fileConnection.send(fileList);

        fileList = Array.from(fileList);

        fileList.forEach(function(file){
            var history = {
                type: 'transfer-start-sending',
                name: file.name,
                size: file.size,
                time: Date.now(),
                id: this._localID,
            };

            this._fileTransfers[file.name] = this.pushHistory(history);
        }, this);
    },


    /**
     * ファイル送信開始
     */
    _startedSendingFile: function(fileName){
        var panel = this._fileTransfers[fileName];
        var label = panel.find('.progress-label')[0];

        panel.find('.progress-bar').removeClass('progress-bar-warning');
        label.textContent = label.dataset.size + ' bytes';
    },


    /**
     * ファイル送信が拒否された
     */
    _cancelledSendingFile: function(fileName){
        var panel = this._fileTransfers[fileName];

        panel.find('.alert-info').removeClass('alert-info')
                                 .addClass('alert-warning');
        panel.find('.transfer-progress').remove();
        $('<small>送信が相手によって拒否されました</small>').appendTo(panel.find('.post-body'));

        delete this._fileTransfers[fileName];

        $('.top-right').notify({
            type: 'danger',
            message: { text: '送信失敗:' + fileName }
        }).show();
    },


    /**
     * ファイル送信が完了した
     */
    _finishedSendingFile: function(fileName){
        var panel = this._fileTransfers[fileName];

        panel.find('.transfer-progress').remove();

        $('<span class="glyphicon glyphicon-ok"' +
                 'style="color:green;"></span> <small>送信完了</small>').appendTo(panel.find('.post-body'));

        delete this._fileTransfers[fileName];

        $('.top-right').notify({
            type: 'success',
            message: { text: '送信成功:' + fileName }
        }).show();
    },


    /**
     * ファイル受信を要求された
     */
    _requestedFile: function(property){
        bootbox.confirm('相手が <strong>' + property.name + '</strong> (' + property.size +' bytes)' +
                        ' の送信を要求しています. ファイルを受信しますか？', function(result){
            if(!result){
                return this._fileConnection.deny(property.name);
            }

            this._fileConnection.accept(property.name);

            var history = {
                type: 'transfer-start-receiving',
                name: property.name,
                size: property.size,
                time: Date.now(),
                id: this._remoteID,
            };

            this._fileTransfers[property.name] = this.pushHistory(history);
        }.bind(this));
    },


    /**
     * ファイル受信が完了した
     */
    _receivedFile: function(file){
        var panel = this._fileTransfers[file.name];

        panel.find('.transfer-progress').remove();
        panel.find('.btn-file').removeClass('disabled')
                               .attr('href', window.URL.createObjectURL(file));

        delete this._fileTransfers[file.name];

        $('.top-right').notify({
            type: 'success',
            message: { text: '受信完了:' + file.name }
        }).show();
    },



    /****************
    /* 音声認識
    /****************/

    /**
     * 音声認識を初期化する
     */
    _initSpeechRecognition: function(){
        if(window.SpeechRecognition){
            this._speech = new SpeechRecognition();

            this._speech.continuous = true;
            this._speech.interimResults = true;
            this._speech.lang = 'ja-JP';

            this._speech.onaudiostart = this._speechRecognitionStart.bind(this);
            this._speech.onresult = $.throttle(1000, this._speechRecognized.bind(this));
            this._speech.onnomatch = this._speechRecognitionError.bind(this);
            this._speech.onerror = this._speechRecognitionError.bind(this);

            this._speech.start();

            //認識が停止していたら再起動する
            this._speechResumeTimer = setInterval(function(){
                try{
                    this._speech.start();
                }catch(ex){}
            }.bind(this), 1000);
        }else{
            $('.top-center').notify({
                type: 'warning',
                message: { text: '音声認識に未対応のブラウザです' }
            }).show();
        }
    },


    /**
     * 音声認識を開始した時に呼ばれる
     */
    _speechRecognitionStart: function(){
        $('.top-center').notify({
            type: 'info',
            message: { text: '音声認識を開始しました' }
        }).show();
    },


    /**
     * 音声認識が完了した時に呼ばれる
     */
    _speechRecognized: function(ev){
        for(var i = ev.resultIndex, iz = ev.results.length; i < iz; i++){
            var result = ev.results[i][0].transcript;
            var isFinal = ev.results[i].isFinal;

            //認識結果が4文字以上の場合にのみ送信する
            if(isFinal || result.length > 4){
                this.sendMessage(result, isFinal, true);
            }

            // 認識結果の文字列長が15文字を超えたら、認識を再起動する
            if(result.length > 15){
                this._speech.stop();
            }
        }
    },


    /**
     * 音声認識に失敗した時に呼ばれる
     */
    _speechRecognitionError: function(ev){
        $('.top-center').notify({
            type: 'danger',
            message: { text: '音声認識失敗' }
        }).show();

        console.error(ev);
    },



    /****************
    /* テキストチャット
    /****************/

    /**
     * チャットメッセージを送信する
     * @param {String} msg 送信するメッセージ
     * @param {Boolean} isFinal 最終確定メッセージかどうか
     */
    sendMessage: function(msg, isFinal, isSpeech){
        var data = {
            type: 'message',
            isFinal: isFinal,
            isSpeech: !!isSpeech,
            time: Date.now(),
            id: this._localID,
            value: msg,
        };

        this.pushHistory(data);

        data = JSON.stringify(data);

        Client.dataConnection.send(data);
    },


    /**
     * 相手からのメッセージを受信した時に呼ばれる
     * @param {MessageData} data 受信したメッセージ
     */
    receivedMessage: function(data){
        if(!data.isFinal) return;
        this.pushHistory(data);
    },



    /****************
    /* チャット履歴表示
    /****************/


    /**
     * データをチャット履歴に追加する
     * @param {MessageData} data 履歴に追加するデータ
     * @return {Element} 追加された履歴エレメント
     */
    pushHistory: function(data){
        var body;
        var type;

        switch(data.type){

            case 'message':
                type = 'well well-sm' +
                        (data.isSpeech ? ' message-speech' : ' message-text') +
                        (!data.isFinal ? ' message-interim' : ' message-final');
                body = data.value;
                break;

            case 'transfer-start-sending':
                type = 'alert alert-info';
                body = "<div class='transfer-header'>" +
                            "<span class='glyphicon glyphicon-floppy-open'></span>" +
                            "<strong>ファイル送信: </strong>" +
                            "<button class='btn btn-default'>" + data.name + "</button>" +
                        "</div>" +
                        "<div class='transfer-progress progress progress-striped active'>" +
                            '<div class="progress-bar progress-bar-warning" role="progressbar"' +
                                  'aria-valuenow="100" aria-valuemin="0"' +
                                  'aria-valuemax="100" style="width: 100%">' +
                                  '<span class="progress-label" data-size="' + data.size + '">' +
                                  '相手の許可を待機しています...</span>' +
                            '</div>' +
                        '</div>';
                break;

            case 'transfer-start-receiving':
                type = 'alert alert-info';
                body = "<div class='transfer-header'>" +
                            "<span class='glyphicon glyphicon-floppy-save'></span>" +
                            "<strong>ファイル受信: </strong>" +
                            "<a class='btn btn-default btn-file disabled'" +
                               "download='" + data.name + "''>" +
                                    data.name +
                            "</a>" +
                        "</div>" +
                        "<div class='transfer-progress progress progress-striped active'>" +
                            '<div class="progress-bar" role="progressbar"' +
                                  'aria-valuenow="100" aria-valuemin="0"' +
                                  'aria-valuemax="100" style="width: 100%">' +
                                  '<span class="progress-label">' + data.size + ' bytes</span>' +
                            '</div>' +
                        '</div>';
                break;

        }


        //push history
        var historyElement = $('\
            <li>\
                <div class="' + type + '">\
                    <div class="post-header">\
                        <span class="glyphicon glyphicon-user"></span>\
                        <strong class="post-username">' + data.id + '</strong>\
                        <small class="post-date">' + (new Date(data.time)).toLocaleString() + '</small>\
                    </div>\
                    <div class="post-body">' + body + '</div>\
                </div>\
            </li>\
        ');

        $('#chat-history').prepend(historyElement);

        return historyElement;
    },


};
