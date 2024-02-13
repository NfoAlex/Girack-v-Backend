const db = require("../src/dbControl.js"); //データベース関連
const msg = require("../src/Message.js"); //メッセージの処理関連
const auth = require("../src/auth.js"); //認証関連
const infoUpdate = require("../src/infoUpdate.js");

const fs = require("fs");

const indexJS = require("../index.js");
const SERVER_VERSION = indexJS.SERVER_VERSION;

//リクエストの整合性確認用
const checkDataIntegrality = indexJS.checkDataIntegrality;
//アクティブなsocketとユーザーIDリストをインポート
let socketOnline = indexJS.socketOnline;
let userOnline = indexJS.userOnline;

console.log("socketAuth :: 認証部分");

module.exports = (io) => {
    io.on("connection", (socket) => {
        //認証
        socket.on("auth", async (key, CLIENT_VERSION) => { //key = "パスワード"
            /*
            key
            {
                username:this.unForAuth,
                password:this.pwForAuth
            }
            */
            // console.log("auth :: 受信 ↓");
            // console.log(key);

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
            /*
            cred
            {
                userid: userid,
                sessionid: sessionid
            }
            */
            
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
            /*
            dat
            {
                username: this.usernameForRegister,
                code: this.invcodeForRegister,
            }
            */
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
                    reqSender: {
                        userid: "SYSTEM",
                        sessionid: null
                    },
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
    });
};