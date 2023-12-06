const fs = require("fs");
const fsPromise = require("fs").promises;
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 33333;

const SERVER_VERSION = "alpha_20231205";
exports.SERVER_VERSION = SERVER_VERSION;

const app = express();
const server = http.createServer(app);

//CORS設定
const io = socketIo(server, {
    maxHttpBufferSize: 1e8, // 100 MB
    cors: {
        credentials: true
    }
});

require("./socketHandler.js")(io);
require("./socketAuth.js")(io);

//必要なディレクトリの確認、なければ作成
try{fs.mkdirSync("./fileidIndex/");}catch(e){}
try{fs.mkdirSync("./files/");}catch(e){}
try{fs.mkdirSync("./usersave/")}catch(e){}
try{fs.mkdirSync("./record/");}catch(e){}
try{fs.mkdirSync("./img/");}catch(e){}
try{fs.mkdirSync("./modlog/");}catch(e){}

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


//サーバーを開く
server.listen(port, () => {
    console.log("*** ver : " + SERVER_VERSION + " ***");
    console.log(`Listening on port ${port}`);

});