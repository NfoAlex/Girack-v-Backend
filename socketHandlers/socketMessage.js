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

console.log("socketMessage :: メッセージ関係");

module.exports = (io) => {
    io.on("connection", (socket) => {

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

    });
};