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

console.log("socketChannel :: チャンネル操作とか");

module.exports = (io) => {
    io.on("connection", (socket) => {
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
            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "channelAction") ) { return -1; }

            //操作して更新されたデータを操作者が受け取る
            let result = infoUpdate.channelAction(dat);
            socket.emit("infoUser", result);

            //もし参加、退出に失敗したならここで停止
            if ( result === -1 ) return;

            let SocketIsOnline = false; //影響を受けるユーザーがオンラインかどうか
            let SocketIDTarget = ""; //影響を受けるユーザーのSocketID

            try {
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
            } catch(e) {
                console.log("socketChannel :: channelAction : e->", e);
                return -1;
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
                reqSender: {
                    userid: "SYSTEM",
                    sessionid: null
                },
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
            msg.msgMix(SystemMessageLogging);
            io.to("loggedin").emit("messageReceive", SystemMessageLogging);
            
        });

        //チャンネル作成
        socket.on("channelCreate", async (dat) => {
            /*
            dat
            {
                channelname: dat.channelname,
                description: dat.description
                reqSender: {
                    userid: "このリクエストを送っているユーザーのID",
                    sessionid: "セッションID"
                },
            }
            */
            //必要パラメータ
            let paramRequire = ["channelname", "description"];
            //整合性確認
            if ( !indexJS.checkDataIntegrality(dat, paramRequire, "channelCreate") ) return -1;

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
            for ( let index in userChanged ) {
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
    });
};