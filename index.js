const db = require("./dbControl.js"); //データベース関連
const msg = require("./Message.js"); //メッセージの処理関連
const auth = require("./auth.js"); //認証関連
const infoUpdate = require("./infoUpdate.js");

const fs = require('fs');
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { config } = require("process");
const e = require("express");

const port = process.env.PORT || 33333;

const SERVER_VERSION = "alpha_20230521";

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

//もしバックエンドに直接アクセスされたら用
app.get('/', (req, res) => {
    res.send("<h1 style='width:100vw; text-align:center'><a href='" + frontendURL[2] + "'>😏</a></h1>");

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

    //ファイルIDからJSON名を取得(日付部分)
    let fileidPathName = fileid.slice(0,4) + "_" + fileid.slice(4,6) + "_" + fileid.slice(6,8);
    //ファイルIDインデックスを取得
    let fileidIndex = JSON.parse(fs.readFileSync('./fileidIndex/' + channelid + '/' + fileidPathName + '.json', 'utf-8')); //ユーザーデータのJSON読み込み

    try {
        //ファイルを返す
        console.log("返すファイルデータ :: ", fileidIndex[fileid]);
        res.download(__dirname + "/files/" + channelid + "/" + fileidPathName + "/" + fileidIndex[fileid].name, fileidIndex[fileid].name); //ユーザーデータのJSON読み込み);
    } catch(e) {
        console.log("index :: app.get('/file/') : ファイル送信失敗", e);
        res.send("ファイルがねえ");
    }

});

////////////////////////////////////////////////////////////////

//URLデータを更新させる
let sendUrlPreview = function sendUrlPreview(urlDataItem, channelid, msgId, urlIndex) {
    let dat = {
        action: "urlData",
        channelid: channelid,
        messageid: msgId,
        urlDataItem: urlDataItem,
        urlIndex: urlIndex
    };

    io.to("loggedin").emit("messageUpdate", dat); //履歴を返す

}

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
                throw new Error("does not have enough parameter > " + paramRequire[termIndex]);
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
    socket.on("msgSend", (m) => {
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

        //整合性の確認
        if ( !checkDataIntegrality(m, paramsRequire, "msgSend") ) return -1;
        
        //セッションIDの確認
        //if ( !auth.checkUserSession({userid:m.userid, sessionid:m.sessionid}) ) { return -1; }

        let msgCompiled = msg.msgMix(m); //メッセージに情報をつける
        if ( msgCompiled === -1 ) { return; } //処理中にエラーがあったなら止める

        //メッセージにURLが含まれるのではあれば
        for ( let index in msgCompiled.urlData.data ) {
            if ( msgCompiled.hasUrl ) {
                //URLプレビューを生成してデータへ追加させる
                msg.addUrlPreview(
                    msgCompiled.urlData.data[index].url,
                    msgCompiled.channelid,
                    msgCompiled.messageid,
                    index
                );

            }

        }

        console.log("msgSend :: 送信するデータ ↓");
        console.log(msgCompiled);
        
        io.to("loggedin").emit("messageReceive", msgCompiled); //全員に送信

    });

    //ファイルアップロードデモ
    socket.on("uploadFile", (files, callback) => {
        fs.writeFile("./files/"+files.name, files.fileData, (err) => {
            console.log("error->", err);
            callback({ message: err ? "failure" : "success" });

        });

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
        dat
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
        //セッション認証
        if ( auth.checkUserSession(dat.reqSender) ) {
            infoUpdate.changeServerSettings(dat); //設定更新

        } else {
            return -1;

        }

        let initInfo = db.getInitInfo();
        let serverSettings = db.getServerSettings(dat);

        //現在のサーバー設定を送信
        socket.emit("infoServerSettings", serverSettings);

        //現在のサーバー情報を全員に通達
        io.to("loggedin").emit("serverinfo", initInfo);

    });

    //チャンネル設定の更新
    socket.on("changeChannelSettings", (dat) => {
        /*
        dat
        {
            targetid: channelid,
            channelname: this.channelnameText,
            description: this.descriptionText,
            reqSender: {
                userid: Userinfo.value.userid,
                sessionid: Userinfo.value.sessionid
            }
        }
        */

        //セッションIDの確認
        if ( !auth.checkUserSession({
            userid: dat.reqSender.userid,
            sessionid: dat.reqSender.sessionid
        }) ) { return -1; }

        if ( dat.description > 128 ) return -1;
        if ( dat.channelname > 32 ) return -1;

        //チャンネル設定更新
        infoUpdate.changeChannelSettings(dat);

        //現在のチャンネルの情報を取得
        let info = db.getInfoChannel({
            targetid: dat.targetid,
            reqSender: dat.reqSender
        });

        io.to("loggedin").emit("infoChannel", info);

    });

    //プロフィールの更新
    socket.on("changeProfile", (dat) => {
        /*
        dat
        {
            name: "変えたい先の名前",
            reqSender: {
                userid: userinfo.userid,
                sessionid: userinfo.sessionid
            }
        }
        */
        
        //セッションIDの確認
        if ( !auth.checkUserSession({
            userid: dat.reqSender.userid,
            sessionid: dat.reqSender.sessionid
        }) ) { return -1; }

        if ( dat.name > 32 ) return -1;

        //プロフィールを更新してからの情報を取得
        let answer = infoUpdate.changeProfile(dat);

        console.log("changeProfile :: 返信する情報↓");
        console.log(answer);
        
        //更新内容を全員へ通知
        io.to("loggedin").emit("infoUser", answer);

    });

    //プロフィールアイコンの更新
    socket.on("changeProfileIcon", (dat) => {
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

        //データ型を調べる
        if ( !checkDataIntegrality(dat, paramRequire, "changeProfileIcon") ) return;

        //もしJPEGかGIFじゃないなら拒否
        if (
            !["image/jpeg","image/gif","image/png"].includes(dat.fileData.type) ||
            dat.fileData.size > 3072000
        ) {
            console.log("このアイコン無理だわ");
            return -1;

        }

        //もしJPEGが先に存在しているなら削除しておく
        fs.access("./img/"+dat.reqSender.userid+".jpeg", (err) => {
            if ( !err ) {
                fs.unlink("./img/"+dat.reqSender.userid+".jpeg", (err) => {
                    if ( err ) console.log(err);
                    console.log("file action taken with JPEG");

                });

            }

        });

        //もしGIFが先に存在しているなら削除しておく
        fs.access("./img/"+dat.reqSender.userid+".gif", (err) => {
            if ( !err ) {
                fs.unlink("./img/"+dat.reqSender.userid+".gif", (err) => {
                    if ( err ) console.log(err);
                    console.log("file action taken with GIF");

                });

            }

        });

        //もしPNGが先に存在しているなら削除しておく
        fs.access("./img/"+dat.reqSender.userid+".png", (err) => {
            if ( !err ) {
                fs.unlink("./img/"+dat.reqSender.userid+".png", (err) => {
                    if ( err ) console.log(err);
                    console.log("file action taken with PNG");

                });

            }

        });

        let iconExtension;
        //拡張子を判別して設定
        if ( dat.fileData.type === "image/jpeg" ) {
            iconExtension = ".jpeg";

        } else if ( dat.fileData.type === "image/gif" ) {
            iconExtension = ".gif";

        } else if ( dat.fileData.type === "image/png" ) {
            iconExtension = ".png";

        }

        //アイコン画像書き込み
        fs.writeFile("./img/"+dat.reqSender.userid+iconExtension, dat.fileData.buffer, (err) => {
            console.log("result->", err);

        });

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

    //チャンネルへの参加、退出
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

        let result = infoUpdate.channelAction(dat);

        //送信者自身が参加or退出をしているなら
        if ( dat.userid === dat.reqSender.userid ) {
            //ユーザーの情報を更新させる
            socket.emit("infoUser", result); //送信者に対してだけ

        } else {
            //ユーザーの情報を更新させる
            io.to("loggedin").emit("infoUser", result); //全員に対して伝える

        }
        
    });

    //チャンネル作成
    socket.on("channelCreate", (dat) => {
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

        //セッションが適合か確認
        if ( auth.checkUserSession(dat.reqSender) ) {

            //結果を受け取るまで待機してから情報を送信する
            new Promise((resolve) => {
                let ans = infoUpdate.channelCreate(dat);
                let retryCount = 0;
                let checkAns = setTimeout(() => {
                    if ( ans ) {
                        clearInterval(ans);
                        resolve(); //次の処理へ

                    }

                    //もし１０回以上試してためだったら
                    if ( retryCount > 10 ) {
                        //ToDo:結果通知
                        return -1; //キャンセルさせる

                    }

                    retryCount++;

                }, 100);
                

            }).then(() => {
                //現在のチャンネルリストを取得
                let channelList = db.getInfoList({
                    target: "channel",
                    reqSender: dat.reqSender
                });

                let userinfoNew = db.getInfoUser({
                    targetid: dat.reqSender.userid,
                    reqSender: dat.reqSender
                });

                //作ったチャンネルを加えてチャンネルリストを送信
                io.to("loggedin").emit("infoList", channelList);
                //チャンネル参加もさせたのでユーザー情報も更新させる
                socket.emit("infoUser",userinfoNew);

            });

        }

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
    socket.on("auth", (key, CLIENT_VERSION) => { //key = "パスワード"
        console.log("auth :: 受信 ↓");
        console.log(key);

        //バージョンチェック
        if ( CLIENT_VERSION !== SERVER_VERSION ) {
            console.log("クライアントとのバージョンが違います");
            return -1;

        }

        let loginAttempt = auth.authUser(key); //ログイン結果

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
    socket.on("changePassword", (dat) => {
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

        if ( !checkDataIntegrality(dat, paramRequire, "changeProfileSecurity") ) return -1

        let result = auth.changePassword(dat);

        //パスワードの変更結果を送信
        socket.emit("changePasswordResult", result);

    });

    //クッキーによる認証
    socket.on("authByCookie", (sessionid, CLIENT_VERSION) => {
        console.log("index :: authByCookie : 認証time");
        
        //バージョンチェック
        if ( CLIENT_VERSION !== SERVER_VERSION ) {
            console.log("クライアントとのバージョンが違います");
            return -1;

        }
        
        //ログイン結果
        let loginAttempt = auth.authUserByCookie(sessionid);

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
            reqSender: { ... }
        }
        */

        let paramRequire = [];

        if ( !checkDataIntegrality(dat, paramRequire, "logout") ) {
            return -1

        }

        //このsocketのIDのユーザーIDを空に
        //socketOnline[socket.id] = "";

        //ユーザーIDの接続数が1以下(エラー回避用)ならオンラインユーザーJSONから削除、そうじゃないなら減算するだけ
        if ( userOnline[dat.reqSender.userid] >= 2 ) {
            userOnline[dat.reqSender.userid] -= 1;

        } else {
            delete userOnline[dat.reqSender.userid];

        }

        //ユーザーのオンライン状態をオフラインとして設定
        db.dataUser.user[dat.reqSender.userid].state.loggedin = false;
        //DBをJSONへ保存
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

        //オンライン人数を更新
        io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

    });

    //新規登録
    socket.on("register", (dat) => {
        console.log("register :: 登録しようとしてる");
        let key = auth.registerUser(dat); //DBにユーザーを登録、パスワードの取得

        //返り値が-1じゃないなら
        if ( key !== -1 ) {
            socket.emit("registerEnd", key); //パスワードを送信
        
        } else {
            socket.emit("registerEnd", -1);

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

            //認証済みセッションとして登録
            socket.join("loggedin");

            //オンライン数を通知
            io.to("loggedin").emit("sessionOnlineUpdate", Object.keys(userOnline).length);

        }

    });

// ===========================================================
// 情報取得系

    //TODO : これを削除
    //情報だけの取得
    socket.on("getInfo", (dat) => {
        /*
        dat
        {
            target: (user | channel | List),
            targetid: "ほしい情報のID",
            reqSender: {
                userid: "このリクエストを送っているユーザーのID",
                sessionid: "セッションID"
            },
            [Listだったら] //(そのターゲットの一覧をとる)
            targetlist: (user | channel)
        }
        */
        let info = 0; //返す情報用
        
        console.log("index :: getInfo : getInfoが使われています...");
        console.log("getInfoを使っているdat -> ");
        console.log(dat);

        //セッションが適合か確認
        if ( auth.checkUserSession({userid:dat.reqSender.userid, sessionid:dat.reqSender.sessionid}) ) {
            info = db.parseInfos(dat); //情報収集

        }

        io.to("loggedin").emit("updatePersonal");
        socket.emit("infoResult", info); //情報を返す

    });

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

        //セッションが適合か確認
        if ( auth.checkUserSession({userid:dat.reqSender.userid, sessionid:dat.reqSender.sessionid}) ) {
            info = db.getInfoUser(dat); //情報収集

        }

        socket.emit("infoUser", info);

        //ユーザー自身のための情報なら送信者にだけ送信
        // if ( info.userid === dat.reqSender.userid ) {
        //     io.to(socket.id).emit("infoUser", info);

        // } else { //他人の情報なら
        //     io.emit("infoUser", info);

        // }

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

        //セッションが適合か確認
        if ( auth.checkUserSession({userid:dat.reqSender.userid, sessionid:dat.reqSender.sessionid}) ) {
            info = db.getInfoChannel(dat); //情報収集

        }

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

    //サーバー設定の取得
    socket.on("getServerSettings", (dat) => {
        /*
        dat
        {
            reqSender: {
                userid: userid
                sessionid: sessionid
            }
        }
        */

        let serverSettings = {};

        if ( !checkDataIntegrality(dat, [], "getServerSettings") ) {
            return -1;

        }

        //セッションが適合か確認
        serverSettings = db.getServerSettings(dat); //情報収集

        //情報送信
        socket.emit("infoServerSettings", serverSettings);

    });

    //初期情報(ログイン前)の送信
    socket.on("getInitInfo", () => {
        //let initInfo = db.getInitInfo();
        let initInfo = {
            servername: db.dataServer.servername, //サーバー名
            registerAvailable: db.dataServer.registration.available, //登録可能かどうか
            inviteOnly: db.dataServer.registration.invite.inviteOnly,
            serverVersion: SERVER_VERSION //招待制かどうか
        };

        socket.emit("serverinfo", initInfo);

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
            action: "delete",
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
        io.to("loggedin").emit("messageUpdate", result); //履歴を返す

    });

// ===========================================================

    //切断時のログ
    socket.on("disconnect", () => {
        console.log("*** " + socket.id + " 切断 ***");
        let useridDisconnecting = "";

        //ユーザーのオンライン状態をオフラインと設定してJSONファイルへ書き込む
        try {
            //オフラインと設定
            db.dataUser.user[socketOnline[socket.id]].state.loggedin = false;
            //DBをJSONへ保存
            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));
        } catch(e) {
            console.log("index :: disconnect : こいつでオフラインにしようとしたらエラー", socketOnline[socket.id]);
        }

        //DBをJSONへ保存
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

        //切断したユーザーをオンラインセッションリストから外す
        try {
            //切断されるsocketIDからユーザーIDを取り出す
            useridDisconnecting = socketOnline[socket.id];
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
    console.log(`Listening on port ${port}`)
});