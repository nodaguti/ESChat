function DataConnection(peer, label){
    this._init.apply(this, arguments);
}

DataConnection.prototype = {

    /**
     * イベントハンドラ
     */
    _listeners: null,


    _init: function(peer, label){
        this._peer = peer;
        this._label = label;

        this._peer.on('connection', this._connected.bind(this));

        this._listeners = {};

        this.connection = new Promise(function(resolve, reject){
            this.on('connected', function(connection){
                resolve(connection);
            });
        }.bind(this));
    },


    /**
     * 相手との接続を確立させる
     * @param {String} remoteID
     * @param {String} [serialization='binary-utf8']
     * @param {Boolean} [reliable=false]
     */
    connect: function(remoteID, serialization, reliable){
        var connection = this._peer.connect(remoteID, {
            label: this._label,
            serialization: serialization || 'binary-utf8',
            reliable: reliable !== undefined ? reliable : false
        });

        connection.on('open', function(){
            this._connected(connection);
        }.bind(this));
    },


    /**
     * 相手にデータを送る
     */
    send: function(data){
        this.connection.then(function(connection){
            connection.send(data);
            console.log('[' + connection.label + '] send data:', data);
        });
    },


    /**
     * 通話を終了する
     */
    close: function(){
        this.connection.then(function(connection){
            connection.close();
        });
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
     * 相手からのデータを受信した時に呼ばれる
     */
    _received: function(data){
        this._fire('received', data);

        this.connection.then(function(connection){
            console.log('[' + connection.label + '] received data:', data);
        });
    },


    /**
     * 相手との接続が完了した時に呼ばれる
     */
    _connected: function(connection){
        //connection イベントには,
        //すべての DataConnection のイベントがくるので,
        //対象のイベント以外ははじく
        if(this._label !== connection.label) return;

        connection.on('data', this._received.bind(this));
        connection.on('close', this._disconnected.bind(this));
        connection.on('error', this._error.bind(this));

        this._fire('connected', connection);
    },


    /**
     * 通信中にエラーが発生したときに呼ばれる
     */
    _error: function(err){
        this._fire('error', err);
    },


};
