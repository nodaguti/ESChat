function MediaConnection(peer){
    this._init.apply(this, arguments);
}

MediaConnection.prototype = {

    /**
     * イベントハンドラ
     */
    _listeners: null,


    _init: function(peer){
        this._peer = peer;
        this._peer.on('call', this._received.bind(this));

        this._listeners = {};

        this.stream = new Promise(function(resolve, reject){
            this.on('connected', function(stream){
                resolve(stream);
            });
        }.bind(this));


        // Client で this.mediaConnection._call.peer
        // とやってもエラーにならないよう空のオブジェクトを入れておく
        this._call = {};
    },


    /**
     * remoteID へ通話のリクエストを行う
     */
    call: function(remoteID, localStream){
        this._call = this._peer.call(remoteID, localStream);
        this._connect();
    },


    /**
     * 相手からの通話要求に応答する
     */
    answer: function(stream){
        this._call.answer(stream);
        this._connect();
    },


    /**
     * 通話を終了する
     */
    close: function(){
        if(this._call){
            this._call.close();
        }
    },


    /**
     * イベントを登録する
     * @param {String} eventName connected, disconnected, received, error
     * @param {Function} listener
     */
    on: function(eventName, listener){
        if(!this._listeners[eventName]){
            this._listeners[eventName] = [];
        }

        this._listeners[eventName].push(listener);
    },


    /**
     * イベントを発火する
     */
    _fire: function(eventName){
        var args = Array.from(arguments);
        args.shift();

        (this._listeners[eventName] || []).forEach(function(listener){
            listener.apply(this, args);
        });
    },


    /**
     * 通話が切断された時に呼ばれる
     */
    _disconnected: function(){
        this._fire('disconnected');
    },


    /**
     * 相手からの通話リクエストを受信する
     */
    _received: function(call){
        this._call = call;

        this._fire('received', call.peer);
    },


    /**
     * 自分/相手 からの通話リスエストをもとに
     * 相手と接続する
     */
    _connect: function(){
        this._call.on('stream', this._connected.bind(this));
        this._call.on('close', this._disconnected.bind(this));
        this._call.on('error', this._error.bind(this));
    },


    /**
     * 相手との接続が完了した時に呼ばれる
     */
    _connected: function(stream){
        this._fire('connected', stream);
    },


    /**
     * 通信中にエラーが発生したときに呼ばれる
     */
    _error: function(err){
        this._fire('error', err);
    },


};
