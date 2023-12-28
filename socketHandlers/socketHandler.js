//socketHandler
const db = require("../src/dbControl.js"); //データベース関連
const msg = require("../src/Message.js"); //メッセージの処理関連
const auth = require("../src/auth.js"); //認証関連
const infoUpdate = require("../src/infoUpdate.js");

const indexJS = require("../index.js");
const SERVER_VERSION = indexJS.SERVER_VERSION;

//ライブラリインポート、設定
const fs = require("fs");
const fsPromise = require("fs").promises;


//アクティブなsocketとユーザーIDリストをインポート
let socketOnline = indexJS.socketOnline;
let userOnline = indexJS.userOnline;

/*********************************************************************************************************************/
//ホスト設定を読み込む

//サーバーをホストするための環境設定を読み込む
const dataHostConfig = require("../HOST_CONFIG.js").HOST_CONFIG;
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



////////////////////////////////////////////////////////////////

console.log("socketHandler :: socketハンドラ");

module.exports = (io) => {
io.on("connection", (socket) => {
    console.log("-------------");
    console.log("* 新規接続");
    console.log("* Origin : ", socket.handshake.headers.origin);
    console.log("-------------");

    //Originチェック
    indexJS.checkOrigin(socket);

// ===========================================================

    //切断時のログ
    socket.on("disconnect", () => {
        console.log("*** " + socket.id + " 切断 ***");
        let useridDisconnecting = socketOnline[socket.id];

        //ユーザーのオンライン状態をオフラインと設定してJSONファイルへ書き込む
        try {
            //もしユーザーの接続数が1以下ならオフラインと記録(次の処理で減算して接続数が0になるから)
            if ( userOnline[useridDisconnecting] <= 1 ) {
                //オフラインと設定
                db.dataUser.user[useridDisconnecting].state.loggedin = false;
                //DBをJSONへ保存
                fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

            }
        } catch(e) {
            console.log("index :: disconnect : こいつでオフラインにしようとしたらエラー", useridDisconnecting);
        }

        //切断したユーザーをオンラインセッションリストから外す
        try {
            //切断されるsocketIDからユーザーIDを取り出す
            console.log("index :: disconnect : これから消すuserid", useridDisconnecting, socketOnline);

            //ユーザーIDの接続数が1以下(エラー回避用)ならオンラインユーザーJSONから削除、そうじゃないなら減算するだけ
            if ( userOnline[useridDisconnecting] >= 2 ) {
                userOnline[useridDisconnecting] -= 1;

            } else {
                delete userOnline[useridDisconnecting];

            }

            delete socketOnline[socket.id]; //接続していたsocketid項目を削除
        } catch(e) {
            console.log("index :: disconnect : 切断時のオンラインユーザー管理でエラー", e);
        }

        //-------------------------------------------
        try {
            //known bug: keyがundefinedの時がある
            if ( useridDisconnecting === undefined ) {
                console.log("index :: disconnect : ユーザーIDがundefinedになっている");
                console.log(useridDisconnecting);
                try {
                    delete userOnline[useridDisconnecting];
                    console.log("index :: disconnect : 不正なユーザーID分は消した");
                } catch(e) {console.log("index :: disconnect : しかも消せなかった");}

            }
        } catch (e) {
            console.log("index :: disconnect : エラー回避用でエラー", e);
        }
        //-------------------------------------------

        //オンライン人数を更新
        io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

        console.log("index :: disconnect : 現在のオンラインセッションりすと -> ");
        console.log(userOnline);

    });

});
};