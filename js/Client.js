/**
 * クライアントクラス
 * 自分の映像, 相手の映像, チャット画面を統括し, それらの相互動作を定義する
 */
var Client = {

    remote: {
        id: null,
        name: null,
        display: null,
        stream: null,
    },


    local: {
        id: null,
        name: null,
        display: null,
        stream: null,
    },


    init: function(){
        this._peer = new Peer({
            host: 'eschat-peerjs.herokuapp.com',
            port: 443,
            key: 'peerjs',
            secure: true,
            //key: 'd9ab1daa-fa73-11e3-bc0f-3f361d1394e4',
            debug: 3
        });

        this._peer.on('open', this._established.bind(this));
        this._peer.on('error', this._error.bind(this));

        this.local.display = new LocalVideo($('#localVideo')[0]);
        this.remote.display = new VideoFrontend($('#remoteVideo')[0], $('#remoteDisplay')[0], $('#headtracker')[0]);

        this.chat = new Chat({
            inputbox: $('.chat-inputbox')[0],
            historybox: $('.chat-historybox')[0],
        });

        //映像通信
        this.mediaConnection = new MediaConnection(this._peer);

        //チャットデータ通信
        this.dataConnection = new DataConnection(this._peer, 'text');

        //ファイルデータ通信
        this.fileConnection = new FileConnection(this._peer);

        //オンラインユーザデータ通信
        this._socket = new WebSocket('wss://eschat-users.herokuapp.com/');

        this._socketOpened = new Promise(function(resolve, reject){
            this._socket.onopen = function(){
                resolve(true);
            };
        }.bind(this));

        this._socket.onmessage = function(message){
            this._onlineUsersList = JSON.parse(message.data);
            $(document).trigger('OnlineUsersUpdated');
        }.bind(this);

        this._socket.onerror = this._error.bind(this);


        this._initButtons();


        //通話許可・拒否の管理は dataConnection の方で行う
        this.mediaConnection.on('received', function(){
            this.mediaConnection.answer(this.local.stream);
        }.bind(this));

        this.dataConnection.on('received', this._receivedData.bind(this));

        this.mediaConnection.on('disconnected', this._disconnected.bind(this));
        this.dataConnection.on('disconnected', this._disconnected.bind(this));
        this.fileConnection.on('disconnected', this._disconnected.bind(this));

        this.mediaConnection.on('error', this._error.bind(this));
        this.dataConnection.on('error', this._error.bind(this));
        this.fileConnection.on('error', this._error.bind(this));

        $(document).on('LocalVideo:Error', this._error.bind(this));

        $(window).on('beforeunload', this.destory.bind(this));
    },


    /**
     * 終了時に呼ぶ
     */
    destory: function(){
        this.close();

        try{
            this._socket.close(1000);
            this._peer.destory();
        }catch(ex){}
    },


    /**
     * ボタンのイベントを設定する
     */
    _initButtons: function(){
        //アバターボタン
        $('.btn-toggle-avatar')[0].addEventListener('click', this._toggleAvatarMode.bind(this), false);

        //通話開始ボタン
        $('#toolbox-container > .btn-call')[0].addEventListener('click', this._showCallDialog.bind(this), false);

        //通話終了ボタン
        $('#toolbox-container > .btn-end')[0].addEventListener('click', this.close.bind(this), false);

        $('[data-toggle="tooltip"]').tooltip();
        $('[data-toggle="popover"]').popover({ html: true });
    },



    /**
     * PeerServer との接続が確立された時に呼ばれる
     * オフラインモードではページの読み込み完了と共に呼ばれる
     */
    _established: function(){
        //自分の映像の準備ができたら通話の用意ができたことになる
        this.local.display.stream.then(this._ready.bind(this))
                                 .catch(this._error.bind(this));
    },


    /**
     * 通話開始の準備ができたら呼ばれる
     */
    _ready: function(localStream){
        this.local.id = this._peer.id;
        this.local.stream = localStream;

        $('#toolbox-container > .btn-call').removeAttr('disabled');
        $('.panel-error-unsupported').hide();

        this._socketOpened.then(function(){
            console.log('opened socket.');
            this._socket.send(JSON.stringify({ type: 'LOGIN', value: this.local.id }));
        }.bind(this));

        bootbox.prompt('スクリーンネームを入力して下さい. (未入力の場合はランダムな文字列になります)', function(name){
            this.local.name = name || this.local.id;

            $('.local-id').text(this.local.name + ' (' + this.local.id + ')');
            this._socket.send(JSON.stringify({ type: 'NAME_CHANGED', value: this.local.name }));
        }.bind(this));


        //チャットが開始したとき
        Promise.all([this.mediaConnection.stream,
                     this.dataConnection.connection,
                     this.fileConnection.connections])
               .then(function(connections){

            this._chatStarted(connections[0]);

        }.bind(this)).catch(this._error.bind(this));
    },


    /**
     * 相手との通信が確立された時に呼ばれる
     */
    _chatStarted: function(remoteStream){
        this.remote.stream = remoteStream;
        this.remote.display.initStream(remoteStream);

        this.chat.start({
            fileConnection: this.fileConnection,
            localID: this.local.name,
            remoteID: this.remote.name
        });

        $('#toolbox-container > .btn-call').attr('disabled', 'disabled');
        $('#toolbox-container > .btn-end').removeAttr('disabled');
        $('#toolbox-container > .btn-upload').removeAttr('disabled');

        $('.local-id').text(this.local.name + ' (' + this.local.id + ')');
        $('.remote-id').text(this.remote.name + ' (' + this.remote.id + ')');

        this._socket.send(JSON.stringify({ type: 'CHAT_STARTED' }));
    },


    /**
     * チャット開始ダイアログを表示する
     */
    _showCallDialog: function(){
        var updateOnlineUsersList = function(){
            var select = $(message[1]);
            var selected = select.val();

            select.empty();

            this._onlineUsersList.sort(function(a, b){
                return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
            }).forEach(function(user){
                if(user.id === this.local.id) return;

                var option = $('<option value="' + user.id + '">' + user.name + ' (' + user.id + ')</option>');

                if(user.status !== 'ONLINE'){
                    option.text(option.text() + ' [' + user.status.toLowerCase() + ']');
                    option.attr('disabled', 'disabled');
                }

                select.append(option);
            }, this);

            if(selected){
                select.find('option[value="' + selected[0] + '"]').prop('selected', true);
            }
        }.bind(this);


        var message = $('<p>チャットをする相手を選択して下さい.</p><select multiple class="form-control"></select>');

        updateOnlineUsersList();

        $(document).on('OnlineUsersUpdated', updateOnlineUsersList);
        $(message[1]).on('click', 'option', function(){
            if($(this.parentNode).val().length > 1){
                this.selected = false;
            }
        });

        bootbox.dialog({
            title: 'チャット開始',
            message: message,
            backdrop: true,
            buttons: {
                cancel: {
                    label: 'Cancel',
                    className: 'btn-default'
                },

                success: {
                    label: 'Call',
                    className: 'btn-primary',
                    callback: function(){
                        this.call($(message[1]).val());
                    }.bind(this)
                }
            }
        });
    },


    /**
     * 相手にチャットの開始要求を送る
     */
    call: function(remoteID){
        this._callingDialog = $('.top-center').notify({
            type: 'info',
            message: { text: '相手の許可を待機しています... '},
            closable: false,
            fadeOut: { enabled: false }
        });
        this._callingDialog.show();

        this.dataConnection.connect(remoteID);
        this.fileConnection.connect(remoteID);

        this.dataConnection.connection.then(function(){
            this.dataConnection.send(JSON.stringify({
                type: 'command',
                name: 'ChatStart',
                args: [ this.local.id, this.local.name ]
            }));
        }.bind(this));
    },


    /**
     * チャットを終了する
     */
    close: function(){
        try{
            this.mediaConnection.close();
            this.dataConnection.close();
            this.fileConnection.close();
        }catch(ex){}

        this._socket.send(JSON.stringify({ type: 'LOGOUT' }));
    },


    /**
     * 開始要求を受信した時に呼ばれる
     */
    _receivedCall: function(remoteID, remoteName){
        bootbox.confirm('<strong>' + remoteName + ' (' + remoteID + ')</strong> からのチャットを受信しました. ' +
                        'チャットを開始しますか？', function(result){

            this.dataConnection.send(JSON.stringify({
                type: 'command',
                name: result ? 'ChatStart-ack' : 'ChatStart-deny',
                args: [ this.local.id, this.local.name ]
            }));

            if(result){
                this.remote.id = remoteID;
                this.remote.name = remoteName;
            }
        }.bind(this));
    },


    /**
     * 通話が相手によって許可された時に呼ばれる
     */
    _acceptedCall: function(remoteID, remoteName){
        this.remote.id = remoteID;
        this.remote.name = remoteName;

        this.mediaConnection.call(remoteID, this.local.stream);

        this._callingDialog.hide();
    },


    /**
     * 通話が相手によって拒否された時に呼ばれる
     */
    _deniedCall: function(){
        this.close();

        this._callingDialog.hide();

        $('.top-center').notify({
            message: { text: 'チャットが相手によって拒否されました. '}
        }).show();
    },


    /**
     * 相手からのテキストを受信した時に呼ばれる
     */
    _receivedData: function(data){
        data = JSON.parse(data);

        switch(data.type){

            case 'message':
                this.remote.display.drawBalloon(data.value, 5000);
                this.chat.receivedMessage(data);
                break;

            case 'command':
                this._doCommand(data.name, data.args);
                break;

            default:
                console.error('Received unknown data.', data);
                break;

        }
    },


    /**
     * 相手から送られてきたコマンドを処理する
     */
    _doCommand: function(name, args){
        switch(name){

            case 'ChangeMode':
                this._changeRemoteVideoMode(args[0]);
                break;

            case 'ChatStart':
                this._receivedCall.apply(this, args);
                break;

            case 'ChatStart-ack':
                this._acceptedCall.apply(this, args);
                break;

            case 'ChatStart-deny':
                this._deniedCall.apply(this, args);
                break;

            default:
                console.error('Unknown Command:', name, args);
                break;

        }
    },


    _sendModeSignal: function(modeName){
        var data = {
            type: 'command',
            name: 'ChangeMode',
            args: [ modeName ]
        };

        data = JSON.stringify(data);
        this.dataConnection.send(data);
    },


    _changeRemoteVideoMode: function(modeName){
        this.remote.display.stop();

        var oldDisplay = $('#remoteDisplay')[0];
        var width = this.remote.display.width;
        var height = this.remote.display.height;

        var newDisplay = this._replaceCanvas(oldDisplay);

        newDisplay.setAttribute('width', width);
        newDisplay.setAttribute('height', height);
        newDisplay.setAttribute('id', 'remoteDisplay');


        switch(modeName){

            case 'video':
                this.remote.display = new VideoFrontend($('#remoteVideo')[0], newDisplay, $('#headtracker')[0]);
                this.remote.display.initStream(this.remote.stream);
                break;

            case 'mmd':
                this.remote.display = new MMDFrontend(newDisplay);
                break;

        }
    },


    _replaceCanvas: function(oldDisplay){
        var newDisplay = document.createElement('canvas');

        oldDisplay.removeAttribute('id');
        oldDisplay.parentNode.insertBefore(newDisplay, oldDisplay);
        oldDisplay.parentNode.removeChild(oldDisplay);

        return newDisplay;
    },


    _toggleAvatarMode: function(){
        var btn = $('.btn-toggle-avatar')[0];
        btn.classList.toggle('active');

        if(btn.classList.contains('active')){
            this._sendModeSignal('mmd');
        }else{
            this._sendModeSignal('video');
        }
    },


    /**
     * 切断時に呼ばれる
     */
    _disconnected: function(){
        this.remote.display.stop();
        this.chat.stop();

        $('.top-center').notify({
            type: 'danger',
            message: { text: 'チャットが切断されました.' }
        }).show();

        $('#toolbox-container > .btn-call').removeAttr('disabled');
        $('#toolbox-container > .btn-end').attr('disabled', 'disabled');
        $('#toolbox-container > .btn-upload').attr('disabled', 'disabled');

        this._socket.send(JSON.stringify({ type: 'CHAT_ENDED' }));
    },


    /**
     * 通信等にエラーが発生した時に呼ばれる
     */
    _error: function(err){
        console.error(err);

        $('.top-center').notify({
            type: 'danger',
            message: { text: err.message || err },
            closable: true,
            fadeOut: { enabled: false }
        }).show();
    },

};
