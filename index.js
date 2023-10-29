const db = require("./dbControl.js"); //データベース関連
const msg = require("./Message.js"); //メッセージの処理関連
const auth = require("./auth.js"); //認証関連
const infoUpdate = require("./infoUpdate.js");

const fs = require("fs");
const fsPromise = require("fs").promises;
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 33333;

const SERVER_VERSION = "alpha_20231029";

const app = express();
const server = http.createServer(app);

//CORS設定
const io = socketIo(server, {
    maxHttpBufferSize: 1e8, // 100 MB
    cors: {
        credentials: true
    }
});

//接続しているSocketJSON
let socketOnline = {
    /*
    "g1r4ck": "12345",
    "asdfghjkl": "12345",
    "socketの接続id": "ユーザーid"
    */
};
//オンラインのユーザーJSON
let userOnline = {
    /*
    "12345": 2,
    "ユーザーid": 接続数
    */
};

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


io.on("connection", (socket) => {
    console.log("-- 新規接続 --");

    //メッセージ処理
    socket.on("msgSend", async (m) => {
        /*
        メッセージのデータ型
        m {
            type: "message"
            userid: userid, //ユーザー固有のID
            channelid: channelid, //チャンネルのID
            content: inputRef.current.input.value, //内容
            hasURL: (true|false), //URLが含まれるかどうか
            sessionid: sessionid //送信者のセッションID
        }
        */

        //データに必要なパラメータ
        let paramsRequire = [
            "userid",
            "channelid",
            "content",
            "replyData",
            "sessionid"
        ];

        //なんかSYSTEMを装ってたらここで停止
        if ( m.userid === "SYSTEM" ) return -1;

        //整合性の確認
        if ( !checkDataIntegrality(m, paramsRequire, "msgSend") ) return -1;
        
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
        if ( checkDataIntegrality(dat, paramRequire, "changeServerSettings") ) {
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
        if ( !checkDataIntegrality(dat, paramRequire, "changeChannelSettings") ) return -1;

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
                userid: "SYSTEM",
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
            let SystemMessageResult = msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageResult);

        }

        //もしチャンネル名が変わっていたらシステムメッセージを送信
        if ( nameChanged ) {
            //記録するシステムメッセージ
            let SystemMessageLogging = {
                userid: "SYSTEM",
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
            let SystemMessageResult = msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageResult);

        }

        //もし公開範囲が変わっていたらシステムメッセージを送信
        if ( scopeChanged && db.dataServer.config.CHANNEL.CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER ) {
            //記録するシステムメッセージ
            let SystemMessageLogging = {
                userid: "SYSTEM",
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
            let SystemMessageResult = msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageResult);

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
        if ( !checkDataIntegrality(dat, paramRequire, "changeProfile") ) {
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
        if ( !checkDataIntegrality(dat, paramRequire, "changeProfileIcon") ) return;

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
        if ( !checkDataIntegrality(dat, paramRequire, "updateUserSaveConfig") ) { return -1; }

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
        if ( !checkDataIntegrality(dat, paramRequire, "updateUserSaveMsgReadState") ) { return -1; }

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
        if ( !checkDataIntegrality(dat, paramRequire, "updateUserSaveChannelOrder") ) { return -1; }

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
        if ( !checkDataIntegrality(dat, paramRequire, "updateUserSessionName") ) return -1;

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
// チャンネル操作、アクション

    //チャンネルへの参加(招待)、退出(キック)
    socket.on("channelAction", (dat) => {
        /*
        dat
        {
            action: ("join" | "leave"),
            channelid: channelid,
            userid: Userinfo.userid
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
        }
        */

        //データに必要なパラメータ
        let paramRequire = [
            "action",
            "channelid",
            "userid",
        ];

        //データの整合性を確認
        if ( !checkDataIntegrality(dat, paramRequire, "channelAction") ) { return -1; }

        //操作して更新されたデータを操作者が受け取る
        let result = infoUpdate.channelAction(dat);
        socket.emit("infoUser", result);

        //もし参加、退出に失敗したならここで停止
        if ( result === -1 ) return;

        let SocketIsOnline = false; //影響を受けるユーザーがオンラインかどうか
        let SocketIDTarget = ""; //影響を受けるユーザーのSocketID

        //操作者と標的ユーザーが同じでなく、標的のユーザーがオンラインなら本人に対して情報を更新させる
        if ( dat.userid !== dat.reqSender.userid && db.dataUser.user[dat.userid].state.loggedin ) {
            //対象のユーザーはオンラインと設定
            SocketIsOnline = true;
            //オンラインのSocketJSONを配列化
            let objsocketOnline =  Object.entries(socketOnline);
            //ループしてSocketIDが一致した項目を探す
            for ( let index in objsocketOnline ) {
                if ( objsocketOnline[index][1] === dat.userid ) {
                    //SocketIDを格納
                    SocketIDTarget = objsocketOnline[index][0];
                    //ユーザーの情報を無理やり取得
                    let resultForPersonal = {
                        username: db.dataUser.user[dat.userid].name, //ユーザーの表示名
                        userid: dat.userid, //ユーザーID
                        channelJoined: db.dataUser.user[dat.userid].channel, //入っているチャンネルリスト(array)
                        role: db.dataUser.user[dat.userid].role, //ユーザーのロール
                        loggedin: db.dataUser.user[dat.userid].state.loggedin, //ユーザーがログインしている状態かどうか
                        banned: db.dataUser.user[dat.userid].state.banned //BANされているかどうか
                    };
                    //SocketIDで参加させる
                    try {
                        io.to(objsocketOnline[index][0]).emit("infoUser", resultForPersonal);
                    } catch(e) {
                        console.log(e);
                    }

                }

            }

        }

        let TERM = ""; //システムメッセージのフラグ
        let targetUser = ""; //対象ユーザー
        let triggeredUser = dat.reqSender.userid; //操作を起こしたユーザー

        //操作内容でフラグ設定
        if ( dat.action === "join" ) { //参加?
            //起こした人と対象が違うなら"招待された"と書く
            if ( dat.userid !== dat.reqSender.userid ) {
                targetUser = dat.userid;
                TERM = "INVITED";

                //Socket主がオンラインならSocketチャンネルに参加させる
                if ( SocketIsOnline ) {
                    try {
                        io.sockets.sockets.get(SocketIDTarget).join(dat.channelid);
                    } catch(e) {
                        console.log(e);
                    }

                }

            } else { //ユーザーが自分で起こしたものなら
                TERM = "JOINED";
                
                //Socketチャンネルへ参加させる
                socket.join(dat.channelid);

            }

        } else if ( dat.action === "leave" ) { //退出?
            //起こした人と対象が違うなら"キックされた"と設定
            if ( dat.userid !== dat.reqSender.userid ) {
                targetUser = dat.userid;
                TERM = "KICKED";

                //Socket主がオンラインならSocketチャンネルから退出させる
                if ( SocketIsOnline ) {
                    try {
                        io.sockets.sockets.get(SocketIDTarget).leave(dat.channelid);
                    } catch(e) {
                        console.log(e);
                    }

                }

            } else { //ユーザーが自分で起こしたものなら
                TERM = "LEFT";

                //Socketチャンネルから抜けさせる
                socket.leave(dat.channelid);

            }

        }

        //記録するシステムメッセージ
        let SystemMessageLogging = {
            userid: "SYSTEM",
            channelid: dat.channelid,
            role: "SYSTEM",
            replyData: {
                isReplying: false,
                messageid: "",
            },
            fileData: { 
                isAttatched: false,
                attatchmentData: null
            },
            content: {
                term: TERM,
                targetUser: targetUser,
                triggeredUser: triggeredUser
            },
            isSystemMessage: true
        };

        //システムメッセージを記録して送信
        let SystemMessageResult = msg.msgMix(SystemMessageLogging);
        io.to("loggedin").emit("messageReceive", SystemMessageLogging);
        
    });

    //チャンネル作成
    socket.on("channelCreate", async (dat) => {
        /*
        dat
        {
            channelname: dat.channelname,
            reqSender: {
                userid: "このリクエストを送っているユーザーのID",
                sessionid: "セッションID"
            },
        }
        */
        //必要パラメータ
        let paramRequire = ["channelname"];
        //整合性確認
        if ( !checkDataIntegrality(dat, paramRequire, "channelCreate") ) return -1;

        //チャンネル作成をする
        let ans = await infoUpdate.channelCreate(dat);
        //失敗したなら止める
        if ( !ans.result ) {
            console.log("index :: channelCreate : チャンネル作成に失敗しました");
            return -1;

        }

        //現在のチャンネルリストを取得
        let channelList = db.getInfoList({
            target: "channel",
            reqSender: dat.reqSender
        });
        //現時点のユーザー情報を取得する
        let userinfoNew = db.getInfoUser({
            targetid: dat.reqSender.userid,
            reqSender: dat.reqSender
        });

        //Socketチャンネルに参加させる
        socket.join(ans.channelid);

        //作ったチャンネルを加えてチャンネルリストを送信
        io.to("loggedin").emit("infoList", channelList);
        //チャンネル参加もさせたのでユーザー情報も更新させる
        socket.emit("infoUser",userinfoNew);

    });

    //チャンネル削除
    socket.on("channelRemove", (dat) => {
        /*
        dat
        {
            channelid: dat.channelid,
            reqSender: {
                userid: "このリクエストを送っているユーザーのID",
                sessionid: "セッションID"
            },
        }
        */

        console.log("index :: channelRemove : チャンネル消すぜ");
        console.log(dat);

        let userChanged = [];

        //セッションが適合か確認
        if ( auth.checkUserSession(dat.reqSender) ) {
            userChanged = infoUpdate.channelRemove(dat);

        }

        //現在のチャンネルリストを取得
        let channelList = db.getInfoList({
            target: "channel",
            reqSender: dat.reqSender
        });

        //送信
        io.to("loggedin").emit("infoList", channelList);

        //消去したチャンネル分、人のプロフィールを更新
        for ( index in userChanged ) {
            //チャンネル削除したのを伝えるためにユーザー情報を収集
            let userNow = db.getInfoUser({
                targetid: userChanged[index],
                reqSender: {
                    userid: userChanged[index], //フル情報をとるため
                }
            });

            //ユーザー情報送信
            io.to("loggedin").emit("infoUser", userNow);
            
        }

    });

// ===========================================================
// 認証関連

    //認証
    socket.on("auth", async (key, CLIENT_VERSION) => { //key = "パスワード"
        console.log("auth :: 受信 ↓");
        console.log(key);

        //バージョンチェック
        if ( CLIENT_VERSION !== SERVER_VERSION ) {
            console.log("クライアントとのバージョンが違います");
            return -1;

        }

        let loginAttempt = await auth.authUser(key); //ログイン結果

        //認証結果を元にユーザーをオンラインとして記録する
        if ( loginAttempt.result ) {
            //オンラインの人リストへ追加
            if ( userOnline[loginAttempt.userid] === undefined ) {
                socketOnline[socket.id] = loginAttempt.userid;
                userOnline[loginAttempt.userid] = 1;

            } else {
                socketOnline[socket.id] = loginAttempt.userid;
                userOnline[loginAttempt.userid] += 1;

            }
            
            //-------------------------------------------
            //known bug: keyがundefinedの時がある
            if ( loginAttempt.userid === undefined ) {
                console.log("index :: auth : ユーザーIDがundefinedになっている");
                console.log(key);
                try {
                    delete userOnline[loginAttempt.userid];
                    console.log("index :: auth : 不正なユーザーID分は消した");
                } catch(e) {console.log("index :: auth : しかも消せなかった");}

            }
            //-------------------------------------------

            //認証済みセッションとして登録
            socket.join("loggedin");

            //参加しているチャンネルのSocketチャンネルへ参加
            for ( let index in loginAttempt.channelJoined ) {
                socket.join(loginAttempt.channelJoined[index]);
                console.log("index :: auth : socket参加->", loginAttempt.channelJoined[index]);

            }

            //ユーザーのオンライン状態を設定
            db.dataUser.user[loginAttempt.userid].state.loggedin = true;
            //DBをJSONへ保存
            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

            console.log("index :: auth : 現在のオンラインセッションりすと -> ");
            console.log(userOnline);

            //オンライン人数を更新
            io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

        }

        socket.emit("authResult", loginAttempt); //認証結果を送信

    });

    //パスワードを変更する
    socket.on("changePassword", async (dat) => {
        /*
        dat
        {
            currentPassword: "..."
            newPassword: "fdsa"
            reqSender: {...}
        }
        */

        console.log("受信はした");

        let paramRequire = [
            "currentPassword",
            "newPassword"
        ];

        if ( !checkDataIntegrality(dat, paramRequire, "changePassword") ) return -1

        let result = await auth.changePassword(dat);

        //パスワードの変更結果を送信
        socket.emit("changePasswordResult", result);

    });

    //sessionidによる認証
    socket.on("authBySession", (cred, CLIENT_VERSION) => {
        console.log("index :: authByCookie : 認証time");
        
        //バージョンチェック
        if ( CLIENT_VERSION !== SERVER_VERSION ) {
            console.log("クライアントとのバージョンが違います");
            return -1;

        }
        
        //ログイン結果
        let loginAttempt = auth.authUserBySession(cred);

        //認証に成功したら
        if ( loginAttempt.result ) {
            //オンラインの人リストへ追加
            if ( userOnline[loginAttempt.userid] === undefined ) {
                socketOnline[socket.id] = loginAttempt.userid;
                userOnline[loginAttempt.userid] = 1;

            } else {
                socketOnline[socket.id] = loginAttempt.userid;
                userOnline[loginAttempt.userid] += 1;

            }

            //ユーザーのオンライン状態を設定
            db.dataUser.user[loginAttempt.userid].state.loggedin = true;

            //DBをJSONへ保存
            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

            console.log("index :: authByCookie : 現在のオンラインセッションりすと -> ");
            console.log(userOnline);

            //認証済みセッションとして登録
            socket.join("loggedin");

            //参加しているチャンネルのSocketチャンネルへ参加
            for ( let index in loginAttempt.channelJoined ) {
                socket.join(loginAttempt.channelJoined[index]);
                console.log("index :: auth : socket参加->", loginAttempt.channelJoined[index]);

            }

            //オンライン人数を更新
            io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

        }

        socket.emit("authResult", loginAttempt); //認証結果を送信

    });

    //ログアウト
    socket.on("logout", (dat) => {
        /*
        dat
        {
            targetSessionid: "",
            reqSender: { ... }
        }
        */

        let paramRequire = ["targetSessionid"];

        if ( !checkDataIntegrality(dat, paramRequire, "logout") ) {
            return -1

        }

        //ユーザーIDの接続数が1以下(エラー回避用)ならオンラインユーザーJSONから削除、そうじゃないなら減算するだけ
        if ( userOnline[dat.reqSender.userid] >= 2 ) {
            userOnline[dat.reqSender.userid] -= 1;

        } else {
            delete userOnline[dat.reqSender.userid];

        }

        //対象のセッションを削除
        try {
            delete db.dataUser.user[dat.reqSender.userid].state.sessions[dat.targetSessionid];
        } catch(e) {}

        //ユーザーのオンライン状態をオフラインとして設定
        db.dataUser.user[dat.reqSender.userid].state.loggedin = false;
        //DBをJSONへ保存
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

        //オンライン人数を更新
        io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

    });

    //新規登録
    socket.on("register", async (dat) => {
        //ユーザー名が２文字以下なら停止
        if ( dat.username.length <= 2 ) {
            socket.emit("registerEnd", {"pass":"", "result": "FAILED"});
            return;

        }

        //DBにユーザーを登録、パスワードとユーザーIDの取得
            //↓useridがついて来るがシステムメッセージにしか使っていない
        let createdUserAuth = await auth.registerUser(dat);

        //成功したら送信
        if ( createdUserAuth.result === "SUCCESS" ) {
            socket.emit("registerEnd", {"pass":createdUserAuth.pass, "result":"SUCCESS"}); //パスワードを送信

            //記録するシステムメッセージ
            let SystemMessageLogging = {
                userid: "SYSTEM",
                channelid: db.dataServer.config.CHANNEL.CHANNEL_DEFAULT_REGISTERANNOUNCE,
                role: "SYSTEM",
                replyData: {
                    isReplying: false,
                    messageid: "",
                },
                fileData: { 
                    isAttatched: false,
                    attatchmentData: null
                },
                content: {
                    term: "WELCOME",
                    targetUser: "",
                    triggeredUser: createdUserAuth.userid
                },
                isSystemMessage: true
            };

            //システムメッセージを記録して送信
            msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageLogging);
        
        } else { //失敗したら失敗を伝える
            socket.emit("registerEnd", {"pass":"", "result": createdUserAuth.result});

        }

    });

    //オンライン人数を加算する再接続時用の関数
    socket.on("countmeAsOnline", (dat) => {
        /*
        dat
        {
            reqSender: {}
        }
        */

        //セッションIDを認証してから加算
        if ( auth.checkUserSession(dat.reqSender) ) {
            //オンラインと保存
            if ( userOnline[dat.reqSender.userid] === undefined ) {
                socketOnline[socket.id] = dat.reqSender.userid;
                userOnline[dat.reqSender.userid] = 1;

            } else {
                socketOnline[socket.id] = dat.reqSender.userid;
                userOnline[dat.reqSender.userid] += 1;

            }

            //ユーザーのオンライン状態を設定
            db.dataUser.user[dat.reqSender.userid].state.loggedin = true;

            //DBをJSONへ保存
            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

            //認証済みセッションとしてSocketチャンネルへ登録
            socket.join("loggedin");

            //参加しているチャンネルのSocketチャンネルへ参加
            for ( let index in db.dataUser.user[dat.reqSender.userid].channel ) {
                socket.join(db.dataUser.user[dat.reqSender.userid].channel[index]);
                console.log("index :: countmeAsOnline : socket参加->", db.dataUser.user[dat.reqSender.userid].channel[index]);

            }

            //オンライン数を通知
            io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

        }

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

        if ( !checkDataIntegrality(dat, paramRequire, "getInfoUser") ) return -1;

        info = db.getInfoUser(dat); //情報収集

        socket.emit("infoUser", info);

    });

    //セッションデータの取得
    socket.on("getInfoSessions", (dat) => {
        //整合性確認
        if ( !checkDataIntegrality(dat, [], "getInfoSessions") ) return -1;
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

        if ( !checkDataIntegrality(dat, paramRequire, "getSessionOnline") ) {
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

        if ( !checkDataIntegrality(dat, paramRequire, "getInfoChannel") ) return -1;

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

        if ( !checkDataIntegrality(dat, paramRequire, "getInfoChannelJoinedUserList") ) {
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
        if ( !checkDataIntegrality(dat, paramRequire, "searchUserDynamic") ) {
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

        if ( !checkDataIntegrality(dat, paramRequire, "getUserSaveConfig") ) { return -1; }

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

        if ( !checkDataIntegrality(dat, paramRequire, "getUserSaveMsgReadState") ) { return -1; }

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

        if ( !checkDataIntegrality(dat, paramRequire, "getUserSaveChannelOrder") ) { return -1; }

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
        if ( !checkDataIntegrality(dat, ["startLength"], "getModlog") ) return -1;

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
                !checkDataIntegrality(dat, [], "getInfoServerFull") &&
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

        if ( !checkDataIntegrality(req, paramRequire, "getInfoChannelJoinedUserList") ) {
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

    //メッセージの削除とかリアクションとか
    socket.on("actMessage", (dat) => {
        /*
        dat
        {
            action: ("delete"|"reaction"),
            channelid: channelid,
            messageid: msgId,
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
        }
        */
        //msg.msgDelete(dat);

        let result = -1; //結果用変数

        let paramRequire = [
            "action",
            "channelid",
            "messageid",
        ];

        if ( !checkDataIntegrality(dat, paramRequire, "actMessage") ) {
            return -1;

        }

        switch( dat.action ) {
            case "delete":
                //削除、そして更新するメッージのIDなどを取り込む
                result = msg.msgDelete(dat);
                break;
            
            case "reaction":
                result = msg.msgReaction(dat);
                break;

        }

        console.log(result);
        /*  ToDo : messageUpdateで更新するようにする  */
        io.to(dat.channelid).emit("messageUpdate", result); //履歴を返す

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
        if ( !checkDataIntegrality(dat, paramRequire, "editMessage") ) return -1;

        //処理を適用してデータ送信
        let contentEdited = msg.msgEdit(dat);
        contentEdited.action = "edit";
        io.to(dat.channelid).emit("messageUpdate", contentEdited);

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


//サーバーを開く
server.listen(port, () => {
    console.log("*** ver : " + SERVER_VERSION + " ***");
    console.log(`Listening on port ${port}`);

});