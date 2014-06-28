function FileConnection(peer){
    this._init.apply(this, arguments);
}

FileConnection.prototype = {


    /**
     * イベントハンドラ
     */
    _listeners: null,



    _init: function(peer){
        this._listeners = {};

        this._controlConnection = new DataConnection(peer, 'file-control');
        this._dataConnection = new DataConnection(peer, 'file-data');

        this._controlConnection.on('received', this._signalReceived.bind(this));
        this._dataConnection.on('received', this._fileReceived.bind(this));

        this._controlConnection.on('disconnected', this._disconnected.bind(this));
        this._dataConnection.on('disconnected', this._disconnected.bind(this));

        this._controlConnection.on('error', this._error.bind(this));
        this._dataConnection.on('error', this._error.bind(this));

        this.connections = Promise.all([this._controlConnection.connection,
                                        this._dataConnection.connection]);
    },


    /**
     * 相手との接続を確立させる
     * @param {String} remoteID
     */
    connect: function(remoteID){
        this._controlConnection.connect(remoteID);
        this._dataConnection.connect(remoteID, 'binary', true);
    },


    /**
     * ファイルを送信する
     * @param {FileList} 送信するファイルのリスト
     * @note https://developer.mozilla.org/en-US/docs/Web/API/FileList
     */
    send: function(fileList){
        this._sender.request.call(this, fileList);
    },


    /**
     * ファイル送信要求を受け入れる
     */
    accept: function(fileName){
        this._receiver.accept.call(this, fileName);
    },


    /**
     * ファイル送信要求を拒否する
     */
    deny: function(fileName){
        this._receiver.deny.call(this, fileName);
    },


    /**
     * 切断する
     */
    close: function(){
        this._controlConnection.close();
        this._dataConnection.close();
    },


    /**
     * イベントを登録する
     * @param {String} eventName started, cancelled, finished, requested, received, disconnected, error
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
     * 制御信号受信
     */
    _signalReceived: function(signal){
        signal = JSON.parse(signal);

        switch(signal.name){

            case 'transfer-start':
                this._receiver.requested.call(this, signal.data);
                break;

            case 'transfer-start-ack':
                this._sender.start.call(this, signal.data);
                break;

            case 'transfer-start-denied':
                this._sender.cancel.call(this, signal.data);
                break;

            case 'transfer-finished-ack':
                this._sender.finished.call(this, signal.data);
                break;

        }
    },


    /**
     * ファイル受信
     */
    _fileReceived: function(arrayBufferData){
        var dataView = new Uint8Array(arrayBufferData);
        var dataBlob = new Blob([dataView]);

        this._receiver.received.call(this, dataBlob);
    },



    /**
     * 送信側の処理
     */
    _sender: {

        /**
         * 送信待機中のファイル
         */
        _pending: {},

        /**
         * 送信中のファイル
         */
        _sending: {},


        /**
         * 送信の開始を相手に要求する
         * @this FileConnection.prototype
         */
        request: function(fileList){
            var self = this._sender;

            fileList = Array.from(fileList);

            //送信待機中のファイルリストに追加する
            fileList.forEach(function(file){
                self._pending[file.name] = file;

                var signal = {
                    name: 'transfer-start',
                    data: {
                        name: file.name,
                        size: file.size
                    }
                };

                this._controlConnection.send(JSON.stringify(signal));
            }, this);
        },


        /**
         * 送信を開始する
         */
        start: function(fileName){
            var self = this._sender;

            self._sending[fileName] = self._pending[fileName];
            delete self._pending[fileName];

            this._fire('started', fileName);

            this._dataConnection.send(self._sending[fileName]);
        },


        /**
         * 送信要求が拒否された
         */
        cancel: function(fileName){
            var self = this._sender;

            delete self._pending[fileName];
            this._fire('cancelled', fileName);
        },


        /**
         * 送信完了
         */
        finished: function(fileName){
            var self = this._sender;

            delete self._sending[fileName];
            this._fire('finished', fileName);
        }
    },



    /**
     * 受信側の処理
     */
    _receiver: {

        /**
         * 受信中のファイル
         */
        _receivingQueue: [],


        /**
         * 送信要求を受信
         * @param {Object} fileProperty .name 名前, .size 大きさ
         */
        requested: function(fileProperty){
            this._fire('requested', fileProperty);
        },


        /**
         * 送信要求を許可
         */
        accept: function(fileName){
            var self = this._receiver;

            var signal = {
                name: 'transfer-start-ack',
                data: fileName
            };


            this._controlConnection.send(JSON.stringify(signal));
            self._receivingQueue.push(fileName);
        },


        /**
         * 送信要求を拒否
         */
        deny: function(fileName){
            var signal = {
                name: 'transfer-start-denied',
                data: fileName
            };

            this._controlConnection.send(JSON.stringify(signal));
        },


        /**
         * ファイルを受信
         * @param {Blob} blob 受信したファイル
         */
        received: function(blob){
            var self = this._receiver;
            var fileName = self._receivingQueue.shift();

            var signal = {
                name: 'transfer-finished-ack',
                data: fileName
            };

            var file = blob;
            file.name = fileName;

            this._controlConnection.send(JSON.stringify(signal));
            this._fire('received', file);
        }

    },



    _disconnected: function(){
        this._fire('disconnected');
    },


    _error: function(err){
        this._fire('error', err);
    }

};
