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

    //メッセージ処理
    socket.on("msgSend", async (m) => {
        /*
        メッセージのデータ型
        m {
            type: "message"
            channelid: channelid, //チャンネルのID
            content: inputRef.current.input.value, //内容
            replyData: {...} //返信データ
            fileData: {...} //ファイルデータ
        }
        */

        //データに必要なパラメータ
        let paramsRequire = [
            "channelid",
            "content",
            "replyData",
            "fileData"
        ];

        //なんかSYSTEMを装ってたらここで停止
        if ( m.userid === "SYSTEM" ) return -1;

        //整合性の確認
        if ( !indexJS.checkDataIntegrality(m, paramsRequire, "msgSend") ) return -1;
        
        let msgCompiled = await msg.msgMix(m); //メッセージに情報をつける
        if ( msgCompiled === -1 ) { return; } //処理中にエラーがあったなら止める

        //メッセージにURLが含まれるのではあれば
        if ( msgCompiled.hasUrl ) {
            //URLの抽出
            let URLinContent = (msgCompiled.content).match(/((https|http)?:\/\/[^\s]+)/g);
            //含んだURL分プレビュー要請
            for ( let index in URLinContent ) {
                //URLプレビューを生成してデータへ追加させる
                msg.addUrlPreview(
                    URLinContent[index],
                    msgCompiled.channelid,
                    msgCompiled.messageid,
                    index
                );

            }

        }
        
        //チャンネル参加者のみに送信
        io.to(m.channelid).emit("messageReceive", msgCompiled);

    });

// ===========================================================
// ユーザーとサーバーの情報更新管理

    //設定の更新とか
    socket.on("config", (dat) => {
        /*
        dat
        {
            target: (user | channel | server),
            targetid: (ユーザーのID | チャンネルのID),
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
            [Userだったら]
                name: "変えたい先の名前",
                Icon: "(画像ファイル)"
            [Channelだったら]
                channelname: "チャンネル名",
                description: "変えたい概要",
                scope: "範囲"
            [Serverだったら]
                servername: "サーバー名",
        }
        */
        
        //セッションIDの確認
        if ( !auth.checkUserSession({
            userid: dat.reqSender.userid,
            sessionid: dat.reqSender.sessionid
        }) ) { return -1; }

        let answer = infoUpdate.config(dat);

        console.log("config :: 返信する情報↓");
        console.log(answer);
        
        //ユーザー情報の更新ならその人にだけ送る
        if ( dat.target === "user" ) {
            socket.emit("infoResult", answer);

        } else { //サーバーかチャンネルの更新なら全員に送信
            io.to("loggedin").emit("infoResult", answer);

        }

    });

    //サーバー設定の更新
    socket.on("changeServerSettings", (dat) => {
        /*
        servername: "xxx",
        registerAnnounceChannel: "0001",
        defaultJoinChannels: ["0001"],
        config: this.displaySettings.config,
        registration: {
            available: this.displaySettings.registerAvailable,
            invite: {
                inviteOnly: this.displaySettings.inviteOnly,
                inviteCode: this.displaySettings.inviteCode
            }
        },
        reqSender: {
            userid: Userinfo.userid,
            sessionid: Userinfo.sessionid
        }
        */

        //セッションと整合性確認
        let paramRequire = [
            "servername",
            "config",
            "registration",
            "registerAnnounceChannel",
            "defaultJoinChannels"
        ];
        if ( indexJS.checkDataIntegrality(dat, paramRequire, "changeServerSettings") ) {
            infoUpdate.changeServerSettings(dat); //設定更新

        } else {
            return -1;

        }

        let serverSettings = db.getInfoServer(dat);
        serverSettings.serverVersion = SERVER_VERSION;

        //現在のサーバー設定を更新した人に返す
        io.to("loggedin").emit("infoServerFull", serverSettings);

        //JSONを渡すように改変するために一度コピー
        let serverSettingsEdited = structuredClone(serverSettings);

        //ログイン前の人向けに招待コードと設定を削除して全員に送信
        delete serverSettingsEdited.registration.invite.inviteCode;

        console.log('送るよ', serverSettingsEdited);
        io.emit("infoServer", serverSettingsEdited);

    });

    //チャンネル設定の更新
    socket.on("changeChannelSettings", (dat) => {
        /*
        dat
        {
            targetid: channelid,
            channelname: this.channelnameText,
            description: this.descriptionText,
            scope: (this.scopeIsPrivate?"private":"public"),,
            canTalk: this.channelCanTalk,
            reqSender: {
                userid: Userinfo.value.userid,
                sessionid: Userinfo.value.sessionid
            }
        }
        */

        let paramRequire = [
            "targetid",
            "channelname",
            "description",
            "scope",
            "canTalk"
        ];

        //データ整合性の確認
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "changeChannelSettings") ) return -1;

        //チャンネル名と概要の長さ制限
        if ( dat.description > 128 ) return -1;
        if ( dat.channelname > 32 ) return -1;

        //システムメッセージに記録するための差異判別
        let descChanged = false; //概要の変更
        let nameChanged = false; //名前の変更
        let scopeChanged = false; //公開範囲の変更
        //もし標的チャンネルと概要が変わってるなら
        if ( db.dataServer.channels[dat.targetid].description !== dat.description ) {
            descChanged = true;

        }
        //もし標的チャンネルと名前が変わってるなら
        if ( db.dataServer.channels[dat.targetid].name !== dat.channelname ) {
            nameChanged = true;

        }
        //もし公開範囲が変わってるなら
        if ( db.dataServer.channels[dat.targetid].scope !== dat.scope ) {
            scopeChanged = true;

        }

        //チャンネル設定更新
        infoUpdate.changeChannelSettings(dat);

        //現在のチャンネルの情報を取得
        let info = db.getInfoChannel({
            targetid: dat.targetid,
            reqSender: dat.reqSender
        });

        //送信
        io.to("loggedin").emit("infoChannel", info);

        //もし概要文が変わっていたらシステムメッセージを送信
        if ( descChanged ) {
            //記録するシステムメッセージ
            let SystemMessageLogging = {
                reqSender: {
                    userid: "SYSTEM",
                    sessionid: null
                },
                channelid: dat.targetid,
                replyData: {
                    isReplying: false,
                    messageid: "",
                },
                fileData: { 
                    isAttatched: false,
                    attatchmentData: null
                },
                content: {
                    term: "DESCRIPTION_UPDATED",
                    targetUser: "",
                    triggeredUser: dat.reqSender.userid
                },
                isSystemMessage: true
            };

            //システムメッセージを記録して送信
            msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageLogging);

        }

        //もしチャンネル名が変わっていたらシステムメッセージを送信
        if ( nameChanged ) {
            //記録するシステムメッセージ
            let SystemMessageLogging = {
                reqSender: {
                    userid: "SYSTEM",
                    sessionid: null
                },
                channelid: dat.targetid,
                replyData: {
                    isReplying: false,
                    messageid: "",
                },
                fileData: { 
                    isAttatched: false,
                    attatchmentData: null
                },
                content: {
                    term: "CHANNELNAME_UPDATED",
                    targetUser: "",
                    triggeredUser: dat.reqSender.userid
                },
                isSystemMessage: true
            };

            //システムメッセージを記録して送信
            msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageLogging);

        }

        //もし公開範囲が変わっていたらシステムメッセージを送信
        if ( scopeChanged && db.dataServer.config.CHANNEL.CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER ) {
            //記録するシステムメッセージ
            let SystemMessageLogging = {
                reqSender: {
                    userid: "SYSTEM",
                    sessionid: null
                },
                channelid: dat.targetid,
                replyData: {
                    isReplying: false,
                    messageid: "",
                },
                fileData: { 
                    isAttatched: false,
                    attatchmentData: null
                },
                content: {
                    term: "SCOPE_UPDATED",
                    targetUser: "",
                    triggeredUser: dat.reqSender.userid
                },
                isSystemMessage: true
            };

            //システムメッセージを記録して送信
            msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageLogging);

        }

    });

    //プロフィールの更新
    socket.on("changeProfile", (dat) => {
        /*
        dat
        {
            name: "変えたい先の名前",
            targetid: "ユーザーID",
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
        }
        */

        let paramRequire = ["name", "targetid"];

        //整合性確認
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "changeProfile") ) {
            return -1;

        }

        //名前の長さを32文字未満、2文字以上限定に
        if ( dat.name.length > 32 && dat.name.length < 2 ) return -1;

        //プロフィールを更新してからの情報を取得
        let answer = infoUpdate.changeProfile(dat);

        console.log("changeProfile :: 返信する情報↓");
        console.log(answer);
        
        //更新内容を全員へ通知
        io.to("loggedin").emit("infoUser", answer);

    });

    //プロフィールアイコンの更新
    socket.on("changeProfileIcon", async (dat) => {
        /*
        dat
        {
            fileData: {
                name: this.files[0].name,
                size: this.files[0].size
                type: ...
                buffer: this.files[0]
            },
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
        }
        */

        let paramRequire = [
            "fileData"
        ];

        //データの整合性を調べる
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "changeProfileIcon") ) return;

        //もしJPEGかGIFじゃないなら、またファイルサイズ制限に引っかかったら拒否
        if (
            !["image/jpeg","image/gif","image/png"].includes(dat.fileData.type) ||
            dat.fileData.size > db.dataServer.config.MESSAGE.MESSAGE_FILE_MAXSIZE
        ) {
            console.log("このアイコン無理だわ");
            return -1;

        }

        // もしJPEGが先に存在しているなら削除しておく
        try {
            await fsPromise.unlink("./img/" + dat.reqSender.userid + ".jpeg");
            console.log("file action taken with JPEG");
        } catch (err) {
            console.log("index :: changeProfileIcon : JPEGナシ");
        }

        // もしGIFが先に存在しているなら削除しておく
        try {
            await fsPromise.unlink("./img/" + dat.reqSender.userid + ".gif");
            console.log("file action taken with GIF");
        } catch (err) {
            console.log("index :: changeProfileIcon : GIFナシ");
        }

        // もしPNGが先に存在しているなら削除しておく
        try {
            await fsPromise.unlink("./img/" + dat.reqSender.userid + ".png");
            console.log("index :: changeProfileIcon : PNGアイコンを削除しました");
        } catch (err) {
            console.log("index :: changeProfileIcon : PNGナシ");
        }

        let iconExtension = "";
        //拡張子を判別して設定
        if ( dat.fileData.type === "image/jpeg" ) {
            iconExtension = ".jpeg";

        } else if ( dat.fileData.type === "image/gif" ) {
            iconExtension = ".gif";

        } else if ( dat.fileData.type === "image/png" ) {
            iconExtension = ".png";

        }

        //アイコン画像書き込み
        try {
            await fsPromise.writeFile("./img/" + dat.reqSender.userid + iconExtension, dat.fileData.buffer);
        } catch (e) {
            console.log(e);
        }

        console.log("index :: changeProfileIcon : アイコン変更処理完了");

    });

    //ユーザーの個人用データで設定情報を上書き保存
    socket.on("updateUserSaveConfig", (dat) => {
        /*
        dat
        {
            config: {...},
            reqSender: {
                ...
            }
        }
        */

        let paramRequire = [
            "config",
        ];

        //整合性確認
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "updateUserSaveConfig") ) { return -1; }

        //ユーザーの個人用データ保存
        infoUpdate.updateUserSaveConfig(dat);

    });

    //ユーザーの個人用データで既読状態を上書き保存
    socket.on("updateUserSaveMsgReadState", (dat) => {
        /*
        dat
        {
            msgReadState: {...},
            reqSender: {
                ...
            }
        }
        */

        let paramRequire = [
            "msgReadState",
        ];

        //整合性確認
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "updateUserSaveMsgReadState") ) { return -1; }

        //ユーザーの個人用データ保存
        infoUpdate.updateUserSaveMsgReadState(dat);

        //もし複数端末でログインしているなら更新させる
        if ( userOnline[dat.reqSender.userid] >= 2 ) {
            //オンラインのSocketJSONを配列化
            let objsocketOnline =  Object.entries(socketOnline);
            //ループしてSocketIDが一致した項目を探す
            for ( let index in objsocketOnline ) {
                if ( objsocketOnline[index][1] === dat.reqSender.userid ) {                    
                    //SocketIDで参加させる
                    try {
                        //io.to(objsocketOnline[index][0]).emit("infoUser", resultForPersonal);
                        //ユーザーの個人用データ取得
                        let userSave = db.getUserSave(dat);

                        //データ送信
                        io.to(objsocketOnline[index][0]).emit("infoUserSaveMsgReadState", {
                            msgReadStateAvailable: userSave.msgReadStateAvailable,
                            msgReadState: userSave.msgReadState
                        });
                    } catch(e) {
                        console.log("index :: updateUserSaveMsgReadState : err->", e);
                    }

                }

            }

        }

    });

    //ユーザーの個人用データでチャンネルの順番を上書き保存
    socket.on("updateUserSaveChannelOrder", (dat) => {
        /*
        dat
        {
            channelOrder: [...],
            reqSender: {...}
        }
        */

        let paramRequire = ["channelOrder"];

        //整合性確認
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "updateUserSaveChannelOrder") ) { return -1; }

        //ユーザーの個人用データ保存
        infoUpdate.updateUserSaveChannelOrder(dat);

    });

    //ユーザーのセッション名を変更
    socket.on("updateUserSessionName", (dat) => {
        /*
        dat
        {
            targetSessionid: asdffdsa123,
            sessionName: "俺",
            reqSender: {...}
        }
        */

        //整合性確認
        let paramRequire = ["targetSessionid", "sessionName"];
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "updateUserSessionName") ) return -1;

        //セッション名を更新(無理だったらここで処理停止)
        try {
            db.dataUser.user[dat.reqSender.userid].state.sessions[dat.targetSessionid].sessionName = dat.sessionName;
        } catch(e) { return -1; }

        //ユーザーデータをJSON書き込み
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

        //セッションデータを取得して送信
        let dataSession = db.dataUser.user[dat.reqSender.userid].state.sessions;
        socket.emit("infoSessions", dataSession);

    });

    //ユーザーの管理、監視
    socket.on("mod", (dat) => {
        /*
        dat
        {
            targetid: this.userid,
            action: {
                change: ("role"|"ban"|"delete"),
                value: "Moderator" あるいは true とか
            },
            reqSender: {...}
        }
        */
       
        console.log("mod...");
        //セッションIDの確認
        if ( !auth.checkUserSession(dat.reqSender) ) { return -1; }

        infoUpdate.mod(dat); //情報更新

        //管理を施したユーザーの情報を取得する
        let userinfoNow = db.getInfoUser({
            targetid: dat.targetid,
            reqSender: dat.reqSender
        });

        //更新したユーザー情報を全員に送信
        io.to("loggedin").emit("infoUser", userinfoNow);

    });

// ===========================================================
// 情報取得系

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

// ===========================================================
// メッセージ関連

    //メッセージ履歴の取得、送信
    socket.on("getMessage", (req) => {
        /*
        {
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            },
            channelid: channelid,
            readLength: readLength,
            startLength: startLength
        }
        */
       //履歴用の変数(初期値はエラーを示す-1)
       let history = -1;

       let paramRequire = [
            "channelid",
            "readLength",
            //"startLength" undefinedだったら0として扱う
       ];

        if ( !indexJS.checkDataIntegrality(req, paramRequire, "getInfoChannelJoinedUserList") ) {
            return -1;

        }

        //履歴を取得する処理
        async function getHistory() {
            if ( req.startLength === undefined ) {
                history = await msg.msgRecordCallNew(req.channelid, req.readLength, 0);

            } else {
                history = await msg.msgRecordCallNew(req.channelid, req.readLength, req.startLength);

            }

        }

        //履歴の取得を待ってから送信
        getHistory().then(() => {
            //もし履歴データが無効なら送らない
            if ( history !== -1 ) {
                //送信
                socket.emit("messageHistory", history);
                //console.log("index :: getMessage : 送る履歴の長さ -> " + history.length);

            }

        });

    });

    //メッセージの単体取得
    socket.on("getMessageSingle", (req) => {
        /*
        {
            reqSender: {...},
            channelid: channelid,
            messageid: msgId
        }
        */

        let paramRequire = [
            "channelid",
            "messageid"
        ];
        if ( !indexJS.checkDataIntegrality(req, paramRequire, "getMessageSingle") ) {return -1;}

        //メッセージ取得
        let msgData = msg.getMessage(req.channelid, req.messageid);
        //送信
        socket.emit("messageSingle_" + req.messageid, msgData);

    });

    //メッセージの削除とかリアクションとか
    socket.on("actMessage", (dat) => {
        /*
        dat
        {
            action: ("pin"|"delete"|"reaction"),
            channelid: channelid,
            messageid: msgId,
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
        }
        */

        let result = -1; //結果用変数

        let paramRequire = [
            "action",
            "channelid",
            "messageid",
        ];
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "actMessage") ) {
            return -1;

        }

        //行動内容によって処理を変える
        switch( dat.action ) {
            case "pin":
                result = msg.msgPin(dat);
                if ( result === -1 ) return;
                //チャンネル情報の更新もしてるからデータを送信
                //現在のチャンネルの情報を取得、送信
                let info = db.getInfoChannel({
                    targetid: dat.channelid,
                    reqSender: dat.reqSender
                });
                console.log("index :: actMessage : channeldata->", info);
                io.to("loggedin").emit("infoChannel", info);

                //もしピン留めを外したならシステムメッセージを送らない
                if (!result.pinned) {break;}

                //記録するシステムメッセージ
                let SystemMessageLogging = {
                    reqSender: {
                        userid: "SYSTEM",
                        sessionid: null
                    },
                    channelid: dat.channelid,
                    replyData: {
                        isReplying: false,
                        messageid: "",
                    },
                    fileData: { 
                        isAttatched: false,
                        attatchmentData: null
                    },
                    content: {
                        term: "MESSAGE_PINNED",
                        targetUser: "",
                        triggeredUser: dat.reqSender.userid
                    },
                    isSystemMessage: true
                };
                //システムメッセージを記録して送信
                msg.msgMix(SystemMessageLogging);
                io.to(dat.channelid).emit("messageReceive", SystemMessageLogging);
                break;

            case "delete":
                //削除、そして更新するメッージのIDなどを取り込む
                result = msg.msgDelete(dat);
                break;
            
            case "reaction":
                result = msg.msgReaction(dat);
                break;

        }

        /*  ToDo : messageUpdateで更新するようにする  */
        io.to(dat.channelid).emit("messageUpdate", result); //履歴を返す

        //最新のメッセージデータ取得
        let msgData = msg.getMessage(dat.channelid, dat.messageid);
        //現状を送信
        io.to(dat.channelid).emit("messageSingle_" + dat.messageid, msgData);

    });

    //メッセージの編集
    socket.on("editMessage", (dat) => {
        /*
        dat
        {
            channelid: "0001",
            messageid: "202301010101010101",
            textEditing: "asdf",
            reqSender: {...}
        }
        */

        let paramRequire = ["textEditing", "messageid", "channelid"];
        if ( !indexJS.checkDataIntegrality(dat, paramRequire, "editMessage") ) return -1;

        //処理を適用してデータ送信
        let contentEdited = msg.msgEdit(dat);
        contentEdited.action = "edit";
        io.to(dat.channelid).emit("messageUpdate", contentEdited);

        //最新のメッセージデータ取得
        let msgData = msg.getMessage(dat.channelid, dat.messageid);
        //現状を送信
        io.to(dat.channelid).emit("messageSingle_" + dat.messageid, msgData);

    });

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