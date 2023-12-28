//ライブラリインポート、設定
const fs = require("fs");
const fsPromise = require("fs").promises;
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

//データ整合性確認用
const auth = require("./src/auth.js");

//サーバーバージョン
const SERVER_VERSION = "alpha_20231218";
exports.SERVER_VERSION = SERVER_VERSION;

//接続しているSocketJSON
let socketOnline = {
    /*
    "g1r4ck": "12345",
    "asdfghjkl": "12345",
    "socketの接続id": "ユーザーid"
    */
};
exports.socketOnline = socketOnline;
//オンラインのユーザーJSON
let userOnline = {
    /*
    "12345": 2,
    "ユーザーid": 接続数
    */
};
exports.userOnline = userOnline;

/*********************************************************************************************************************/
//ホスト設定を読み込む

//サーバーをホストするための環境設定を読み込む
const dataHostConfig = require("./HOST_CONFIG.js").HOST_CONFIG;
console.log("dbControl :: 読み込んだホスト設定 -> ", dataHostConfig);

//もしそもそも設定が無効なら警告して止める
if ( dataHostConfig === undefined ) {
    console.error("\nindex :: サーバーホスト設定が取得できませんでした。リポジトリより'HOST_CONFIG.js'を再取得してください。\n");
    return -1;

}

    //Origin許可設定
    const ALLOWED_ORIGIN = dataHostConfig.allowedOrigin || []; //無効なら全ドメイン許可

    //ポート番号
    const port = dataHostConfig.port || 33333; //無効なら33333にする
/*********************************************************************************************************************/

//サーバーインスタンスを構成する
const app = express();
const server = http.createServer(app);

//CORS設定
const io = socketIo(server, {
    maxHttpBufferSize: 1e8, // 100 MB
});

//必要なディレクトリの確認、なければ作成
    //フォルダ親
try{fs.mkdirSync("./userFiles/");}catch(e){}
try{fs.mkdirSync("./serverFiles/");}catch(e){}
    //その下
try{fs.mkdirSync("./userFiles/fileidIndex/");}catch(e){}
try{fs.mkdirSync("./userFiles/files/");}catch(e){}
try{fs.mkdirSync("./userFiles/usersave/")}catch(e){}
try{fs.mkdirSync("./userFiles/img/");}catch(e){}
try{fs.mkdirSync("./serverFiles/record/");}catch(e){}
try{fs.mkdirSync("./serverFiles/modlog/");}catch(e){}

//もしバックエンドに直接アクセスされたら用
app.get('/', (req, res) => {
    res.send("<h1 style='width:100vw; text-align:center'>😏</h1>");

});

//アイコン用ファイルを返す
app.get('/img/:src', (req, res) => {
    //JPEG
    try {
        fs.statSync(__dirname + '/img/' + req.params.src + ".jpeg");
        res.sendFile(__dirname + '/img/' + req.params.src + ".jpeg");
        return;
    }
    catch(e) {
    }

    //PNG
    try {
        fs.statSync(__dirname + '/img/' + req.params.src + ".png");
        res.sendFile(__dirname + '/img/' + req.params.src + ".png");
        return;
    }
    catch(e) {
    }

    //GIF
    try {
        fs.statSync(__dirname + '/img/' + req.params.src + ".gif");
        res.sendFile(__dirname + '/img/' + req.params.src + ".gif");
    }
    catch(e) {
        console.log("index :: これがなかった -> " + req.params.src + ".gif");
        res.sendFile(__dirname + '/img/default.jpeg');
    }

});

//ファイルを返す
app.get('/file/:channelid/:fileid', (req, res) => {
    let fileid = req.params.fileid; //ファイルIDを取得
    let channelid = req.params.channelid; //チャンネルIDを取得

    let fileidPathName = ""; //JSONファイル名
    let fileidIndex = {}; //JSONファイルから取り出したJSONそのもの

    //JSONファイルの取り出し準備
    try {
        //ファイルIDからJSON名を取得(日付部分)
        fileidPathName = fileid.slice(0,4) + "_" + fileid.slice(4,6) + "_" + fileid.slice(6,8);
        //ファイルIDインデックスを取得
        fileidIndex = JSON.parse(fs.readFileSync('./fileidIndex/' + channelid + '/' + fileidPathName + '.json', 'utf-8')); //ユーザーデータのJSON読み込み
    } catch(e) {
        res.send("内部エラー", e);
    }

    //JSONから添付ファイルを探して返す
    try {        
        //もし画像ファイルならダウンロードじゃなく表示させる
        if ( fileidIndex[fileid].type.includes("image/") ) { //typeにimageが含まれるなら
            //ブラウザで表示
            res.sendFile(__dirname + "/files/" + channelid + "/" + fileidPathName + "/" + fileidIndex[fileid].name, fileidIndex[fileid].name); //ユーザーデータのJSON読み込み);

        } else { //画像じゃないなら
            //ダウンロードさせる
            res.download(__dirname + "/files/" + channelid + "/" + fileidPathName + "/" + fileidIndex[fileid].name, fileidIndex[fileid].name); //ユーザーデータのJSON読み込み);

        }
    } catch(e) {
        res.send("ファイルがねえ", e);
    }

});

////////////////////////////////////////////////////////////////

//URLデータを更新させる
let sendUrlPreview = function sendUrlPreview(urlDataItem, channelid, msgId) {
    // let dat = {
    //     action: "urlData",
    //     channelid: channelid,
    //     messageid: msgId,
    //     urlDataItem: urlDataItem,
    // };

    let dat = {
        action: "urlData",
        channelid: channelid,
        messageid: msgId,
        urlDataItem: urlDataItem,
    };

    io.to("loggedin").emit("messageUpdate", dat); //履歴を返す

}
//外部スクリプトで使う用
exports.sendUrlPreview = sendUrlPreview;

////////////////////////////////////////////////////////////////

//データが正規のものか確認する
function checkDataIntegrality(dat, paramRequire, funcName) {

    try{
        //パラメータが足りているか確認
        for ( let termIndex in paramRequire ) {
            if ( dat[paramRequire[termIndex]] === undefined ) {
                console.log("-------------------------------");
                console.log("ERROR IN ", dat);
                console.log("does not have enough parameter > " + paramRequire[termIndex]);
                console.log("-------------------------------");

            }

        }

    }
    catch(e) {
        console.log("index :: checkDataIntegrality : " + funcName + " : error -> " + e);
        return false;

    }

    //セッションIDの確認
    if ( !auth.checkUserSession(dat.reqSender) ) { return false; }

    console.log("index :: checkDataIntegrality : 確認できた => " + funcName);

    //確認できたと返す
    return true;

}
exports.checkDataIntegrality = checkDataIntegrality;

////////////////////////////////////////////////////////////////

//Socketのオリジンを設定に適合しているか確認
function checkOrigin(socket) {
    //アクセスしたオリジンの比較、制限（人力CORS）
    if (
        //ORIGIN情報があり、
        socket.handshake.headers.origin !== undefined
            &&
        //許可するドメインが指定されており、
        ALLOWED_ORIGIN.length !== 0
            &&
        ( //同一環境からのアクセスでないなら
            !socket.handshake.headers.origin.startsWith("http://localhost")
                &&
            !socket.handshake.headers.origin.startsWith("http://127.0.0.1")
        )
    ) { //ドメイン設定と比較して許可できるか調べる
        //許可されているかどうか
        let flagOriginAllowed = false;
        //許可されたドメインの数分ループを回して判別
        for ( let index in ALLOWED_ORIGIN)  {
            //Originがそのドメインから始まっているかどうかで判別
            if ( socket.handshake.headers.origin.startsWith(ALLOWED_ORIGIN[index]) ) {
                flagOriginAllowed = true; //許可されたドメインと設定
                break; //ループ停止
            }

        }

        //許可されなかったのならsocket通信を切る
        if ( !flagOriginAllowed ) socket.disconnect(); //切断

    //そもそもOriginがなければ切断
    } else if ( socket.handshake.headers.origin === undefined ) {
        socket.disconnect(); //切断

    }

}
exports.checkOrigin = checkOrigin;

////////////////////////////////////////////////////////////////

//Socketハンドラのインポート
require("./socketHandlers/socketHandler.js")(io);
require("./socketHandlers/socketAuth.js")(io);
require("./socketHandlers/socketChannel.js")(io);
require("./socketHandlers/socketGetInfo.js")(io);
require("./socketHandlers/socketMessage.js")(io);


//サーバーを開く
server.listen(port, () => {
    console.log("*** ver : " + SERVER_VERSION + " ***");
    console.log(`Listening on port ${port}`);

});