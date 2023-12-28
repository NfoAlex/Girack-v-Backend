const db = require("../src/dbControl.js"); //データベース関連
const msg = require("../src/Message.js"); //メッセージの処理関連
const auth = require("../src/auth.js"); //認証関連
const infoUpdate = require("../src/infoUpdate.js");

const fs = require("fs");

const indexJS = require("../index.js");
//サーバーバージョン
const SERVER_VERSION = indexJS.SERVER_VERSION;

//アクティブなsocketとユーザーIDリストをインポート
let socketOnline = indexJS.socketOnline;
let userOnline = indexJS.userOnline;

console.log("socketGetInfo :: 情報取得系");

module.exports = (io) => {
    io.on("connection", (socket) => {
        //リスト情報を返す
        socket.on("getInfoList", (dat) => {
            /*
            dat
            {
                target: ("channel"|"user") //ほしいリスト
                reqSender: {
                    userid: "このリクエストを送っているユーザーのID",
                    sessionid: "セッションID"
                },
            }
            */
            let info = -1; //返す情報用

            //セッションが適合か確認
            if ( auth.checkUserSession({userid:dat.reqSender.userid, sessionid:dat.reqSender.sessionid}) ) {
                info = db.getInfoList(dat); //情報収集

            }
            
            //io.to(socket.id).emit("infoList", info);
            socket.emit("infoList", info);

        });

        //ユーザーの情報を取得
        socket.on("getInfoUser", (dat) => {
            /*
            dat
            {
                targetid: "ほしい人情報のID",
                reqSender: {
                    userid: "このリクエストを送っているユーザーのID",
                    sessionid: "セッションID"
                },
            }
            */
            let info = -1; //返す情報用
            let paramRequire = [
                "targetid"
            ];

            console.log("index :: getInfoUser : データ->", dat);

            //整合性確認
            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getInfoUser") ) return -1;

            info = db.getInfoUser(dat); //情報収集

            socket.emit("infoUser", info);

        });

        //セッションデータの取得
        socket.on("getInfoSessions", (dat) => {
            //整合性確認
            if ( !indexJS.checkDataIntegrality(dat, [], "getInfoSessions") ) return -1;
            //セッションデータの取得
            let infoSessions = db.getInfoSessions(dat);

            //データを送る
            socket.emit("infoSessions", infoSessions);

        });

        //オンラインのユーザーリストを返す
        socket.on("getSessionOnline", (dat) => {
            /*
            dat
            {
                reqSender: {...}
            }
            */

            let paramRequire = [
            ];

            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getSessionOnline") ) {
                return -1;

            }

            //オンラインの人のユーザーIDが入る配列
            let sessionOnlineList = [];

            //オンラインリストのJSONを配列化
            let objUserOnline = Object.keys(userOnline);

            //リストの長さ分配列へユーザーIDを追加
            for ( let index in objUserOnline ) {
                //配列へ追加
                sessionOnlineList.push(objUserOnline[index]);

            }

            console.log("index :: getSessionOnline : オンラインの人リスト");
            console.log(sessionOnlineList);

            //結果を送信
            socket.emit("resultSessionOnline", sessionOnlineList);

        });

        //チャンネルの情報を返す
        socket.on("getInfoChannel", (dat) => {
            /*
            dat
            {
                targetid: "ほしいチャンネル情報のID",
                reqSender: {
                    userid: "このリクエストを送っているユーザーのID",
                    sessionid: "セッションID"
                },
            }
            */
            let info = -1; //返す情報用

            let paramRequire = [
                "targetid"
            ];

            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getInfoChannel") ) return -1;

            info = db.getInfoChannel(dat); //情報収集

            //チャンネルの情報送信
            socket.emit("infoChannel", info);

        });

        //チャンネルに参加している人のリストを返す
        socket.on("getInfoChannelJoinedUserList", (dat) => {
            /*
            dat
            {
                targetid: "ほしいチャンネル情報のID",
                reqSender: {
                    userid: "このリクエストを送っているユーザーのID",
                    sessionid: "セッションID"
                },
            }
            */
            let channelJoinedUserList = -1; //返す情報用

            let paramRequire = [
                "targetid"
            ];

            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getInfoChannelJoinedUserList") ) {
                return -1;

            }

            //セッションが適合か確認
            channelJoinedUserList = db.getInfoChannelJoinedUserList(dat); //情報収集

            //チャンネルの情報送信
            socket.emit("infoChannelJoinedUserList", channelJoinedUserList);

        });

        //ユーザー検索をするだけ
        socket.on("searchUserDynamic", (dat) => {
            /*
            dat
            {
                query: this.userSearchQuery,
                reqSender: {
                    ...
                }
            }
            */

            //整合性確認
            let paramRequire = [
                "query"
            ];
            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "searchUserDynamic") ) {
                return -1;

            }

            //検索する
            let searchResult = db.searchUserDynamic(dat);

            //検索結果を送信
            socket.emit("infoSearchUser", searchResult);

        });

        //ユーザーの個人用データで設定データを取得
        socket.on("getUserSaveConfig", (dat) => {
            /*
            dat
            {
                reqSender: {
                    ...
                }
            }
            */

            let paramRequire = [];

            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getUserSaveConfig") ) { return -1; }

            //ユーザーの個人用データ取得
            let userSave = db.getUserSave(dat);

            //データ送信
            socket.emit("infoUserSaveConfig", {
                configAvailable: userSave.configAvailable,
                config: userSave.config
            });

        });

        //ユーザーの個人用データで既読状態を取得
        socket.on("getUserSaveMsgReadState", (dat) => {
            /*
            dat
            {
                reqSender: {
                    ...
                }
            }
            */

            let paramRequire = [];

            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getUserSaveMsgReadState") ) { return -1; }

            //ユーザーの個人用データ取得
            let userSave = db.getUserSave(dat);

            //データ送信
            socket.emit("infoUserSaveMsgReadState", {
                msgReadStateAvailable: userSave.msgReadStateAvailable,
                msgReadState: userSave.msgReadState
            });

        });

        //ユーザーの個人用データでチャンネル順番を取得
        socket.on("getUserSaveChannelOrder", (dat) => {
            /*
            dat
            {
                reqSender: {
                    ...
                }
            }
            */

            let paramRequire = [];

            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "getUserSaveChannelOrder") ) { return -1; }

            //ユーザーの個人用データ取得
            let userSave = db.getUserSave(dat);
            //ユーザーの個人データの中でチャンネルの順番が空なら空で渡す
            if ( userSave.channelOrder === undefined ) {
                userSave.channelOrder = [];

            }

            //データ送信
            socket.emit("infoUserSaveChannelOrder", {
                channelOrder: userSave.channelOrder
            });

        });

        //監査ログの取得
        socket.on("getModlog", async (dat) => {
            /*
            dat
            {
                startLength: 0, //メッセージの取得開始位置
                reqSender: {
                    ...
                }
            }
            */
        
            //パケットの整合性確認
            if ( !indexJS.checkDataIntegrality(dat, ["startLength"], "getModlog") ) return -1;

            //監査ログ取得(getModlog関数は時間がかかるためasyncにしているのでawait)
            let modLog = await db.getModlog(dat);

            //送信
            socket.emit("infoModlog", modLog);
            
        });

        //サーバー情報の送信(ゲスト、一般ユーザー用)
        socket.on("getInfoServer", () => {
            //サーバー情報格納用
            let serverSettings = {};

            //あらかじめサーバー情報を取得
            serverSettings = db.getInfoServer(); //情報収集
            serverSettings.serverVersion = SERVER_VERSION; //バージョン情報をつける

            //JSONをいじるため完全にコピー
            let serverSettingsEdited = structuredClone(serverSettings);

            //招待コードと設定データを削除
            delete serverSettingsEdited.registration.invite.inviteCode;

            //送信
            socket.emit("infoServer", serverSettingsEdited);

        });

        //サーバー初期情報の送信(管理者用)
        socket.on("getInfoServerFull", (dat) => {
            try {
                //権限と整合性チェック
                if (
                    !indexJS.checkDataIntegrality(dat, [], "getInfoServerFull") &&
                    db.dataServer.user[dat.reqSender.userid].role !== "Admin"
                ) {
                    return -1;

                }
            } catch(e) {}

            //セッションが適合か確認
            serverSettings = db.getInfoServer(); //情報収集
            serverSettings.serverVersion = SERVER_VERSION; //バージョン情報をつける

            //情報送信
            socket.emit("infoServerFull", serverSettings);

        });

    });
};