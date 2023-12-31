import * as fs from "fs";
import * as http from "http";
import { Server, Socket } from "socket.io";
import express from "express";
import { HOST_CONFIG } from "./HOST_CONFIG";
import { checkUserSession } from "./src/auth"; // authモジュールから適切な関数をimportする
import { dataUser } from "./src/dbControl";
//import { registerSocketHandlers } from "./socketHandlers"; // 仮定のsocketHandlersモジュールから関数をimportする

// 型定義 (適切な型に置き換える必要があるかもしれません)
interface SocketOnline {
  [key: string]: string;
}

interface UserOnline {
  [key: string]: number;
}

// 初期設定
const SERVER_VERSION: string = "alpha_20231228";
const socketOnline: SocketOnline = {};
const userOnline: UserOnline = {};

// ...rest of your code...

// ExpressとSocket.IOのサーバー作成
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: HOST_CONFIG.allowedOrigin as string[],
    methods: ["GET", "POST"]
  }
});

// ミドルウェア、ルーティングの設定など...

//reqSenderの型定義
interface reqSender {
    userid: string,
    sessionid: string
};

//URLデータを更新させる
let sendUrlPreview = function sendUrlPreview(urlDataItem:any, channelid:string, msgId:string) {
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

//データが正規のものか確認する
function checkDataIntegrality(dat:any, paramRequire:string[], funcName:string) {

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
    if ( !checkUserSession(dat.reqSender) ) { return false; }

    console.log("index :: checkDataIntegrality : 確認できた => " + funcName);

    //確認できたと返す
    return true;

}

//Origin判別
function checkOrigin(socket:Socket) {
    //アクセスしたオリジンの比較、制限（人力CORS）
    if (
        //ORIGIN情報があり、
        socket.handshake.headers.origin !== undefined
            &&
        //許可するドメインが指定されており、
        HOST_CONFIG.allowedOrigin.length !== 0
            &&
        ( //同一環境からのアクセスでないなら
            !socket.handshake.headers.origin.startsWith("http://localhost")
                &&
            !socket.handshake.headers.origin.startsWith("http://127.0.0.1")
        )
    ) { //ドメイン設定と比較して許可できるか調べる
        //許可されているかどうか
        let flagOriginAllowed:boolean = false;
        //許可されたドメインの数分ループを回して判別
        for ( let index in HOST_CONFIG.allowedOrigin)  {
            //Originがそのドメインから始まっているかどうかで判別
            if ( socket.handshake.headers.origin.startsWith(HOST_CONFIG.allowedOrigin[index]) ) {
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

//Socketハンドラのインポート
require("./socketHandlers/socketAuth.js")(io);
require("./socketHandlers/socketChannel.js")(io);
require("./socketHandlers/socketGetInfo.js")(io);
require("./socketHandlers/socketMessage.js")(io);
require("./socketHandlers/socketUpdateInfo.js")(io);

// Socketイベントハンドラの設定
io.on("connection", (socket:Socket) => {
    //Origin判別
    checkOrigin(socket);

    //切断時のログ
    socket.on("disconnect", () => {
        console.log("*** " + socket.id + " 切断 ***");
        let useridDisconnecting:string = socketOnline[socket.id];

        //ユーザーのオンライン状態をオフラインと設定してJSONファイルへ書き込む
        try {
            //もしユーザーの接続数が1以下ならオフラインと記録(次の処理で減算して接続数が0になるから)
            if ( userOnline[useridDisconnecting] <= 1 ) {
                //オフラインと設定
                dataUser.user[useridDisconnecting].state.loggedin = false;
                //DBをJSONへ保存
                fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4));

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
})

// サーバーの開始
server.listen(HOST_CONFIG.port, () => {
  console.log(`*** ver : ${SERVER_VERSION} ***`);
  console.log(`Listening on port ${HOST_CONFIG.port}`);
});

// モジュールエクスポート
export { SERVER_VERSION, socketOnline, userOnline, checkDataIntegrality, sendUrlPreview, checkOrigin };
