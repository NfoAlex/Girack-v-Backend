//auth.js

import * as fs from "fs"; //履歴書き込むため
import * as srcInterface from "./interfaceSrc";
const bcrypt = require("bcrypt"); //ハッシュ化用
let db = require("./dbControl");
import { dataServer, dataUser } from "./dbControl";
//import { db } from "./dbControl";

//ユーザー認証
let authUser = async function authUser(
        cred:{username:string, password:string}
    ) {
    console.log("authUser :: これから確認...");
    //入力情報がテキストじゃないなら阻止
    if ( typeof(cred.password) !== "string" || typeof(cred.username) !== "string" ) {
        return { result:false };

    }

    //データからユーザー名とパスワード(ハッシュ化)を抽出
    let username = cred.username;
    let password = cred.password;

    //それぞれのユーザーリストの中でパスワードが一致しているやつを探す
    for (let i=0; i<Object.keys(dataUser.user).length; i++ ) {
        //ユーザーIDを巡回
        let index = Object.keys(dataUser.user)[i];

        //ユーザー名とパスワードの一致を確認してセッションIDを生成する
        if ( dataUser.user[index].name === username ) {
            //パスワードのハッシュ値計算
            let passComparedResult = await bcrypt.compare(password, dataUser.user[index].pw);
            //認証成功したら
            if ( passComparedResult ) {
                //セッションID入れるよう
                let _session = "";

                //BANされているならそう結果を返す
                if ( dataUser.user[index].state.banned ) {
                    return {result: false};

                }

                //セッションID用に24文字のコードを生成
                let sessionidCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; //セッションIDに使う英数字
                let sessionidLength = 24; //文字数
                _session = Array.from(Array(sessionidLength)).map(()=>sessionidCharset[Math.floor(Math.random()*sessionidCharset.length)]).join('');

                let username = dataUser.user[index].name; //ユーザー名取得
                
                //ログイン時間を記録する用
                let t = new Date();
                //ログイン時間(分まで)を変数へ格納
                let _loginTime = t.getFullYear() + (t.getMonth()+1).toString().padStart(2,"0") + t.getDate().toString().padStart(2,"0") + t.getHours().toString().padStart(2,"0") + t.getMinutes().toString().padStart(2,"0");
                try {
                    //セッションコードとデバイスを設定
                    dataUser.user[index].state.sessions[_session] = {
                        sessionName: "とあるデバイス",
                        loggedinTime: _loginTime,
                        loggedinTimeFirst: _loginTime
                    };
                } catch(e) {
                    //セッションいれるところすらないなら作る
                    dataUser.user[index].state.sessions = {};
                    dataUser.user[index].state.sessions[_session] = {
                        sessionName: "とあるデバイス",
                        loggedinTime: _loginTime,
                        loggedinTimeFirst: _loginTime
                    };
                }

                // !!!! ↓↓将来削除する↓↓ !!!!
                /************************************************************/
                //パスワードが平文保存されているならハッシュ化して保存
                if ( dataUser.user[index].pw === password ) {
                    dataUser.user[index].pw = await bcrypt.hash(cred.password, 10);

                }
                //以前の形式のせっしょんIDがあるなら削除
                if ( dataUser.user[index].state.session_id !== undefined ) {
                    delete dataUser.user[index].state.session_id;
                }
                /************************************************************/
                
                //サーバーのJSONファイルを更新
                fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4));
                
                return {
                    result: true, //ログイン成功の印
                    userid: index, //ユーザーID
                    username: username, //ユーザー名
                    sessionid: _session, //セッションコード
                    role: dataUser.user[index].role, //ロール
                    channelJoined: dataUser.user[index].channel //参加しているチャンネル
                }; //ユーザーの情報を送信

            }

        }

    }

    console.log("authUser :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false };

}

//パスワードを変更
let changePassword = async function changePassword(dat:{
    currentPassword: string,
    newPassword: string,
    reqSender: srcInterface.reqSender
}):Promise<number> {
    //現在のパスワードをハッシュ比較
    let passComparedResult = await bcrypt.compare(dat.currentPassword, dataUser.user[dat.reqSender.userid].pw);

    //今のパスワードが一致しないならここで停止
    if (
        dataUser.user[dat.reqSender.userid].pw !== dat.currentPassword && //平文でも比較　次期ビルドで削除
        !passComparedResult
    ) {
        return -1;
    }

    //パスワードをハッシュ化
    let newPassword = await bcrypt.hash(dat.newPassword, 10);

    //パスワード変更
    dataUser.user[dat.reqSender.userid].pw = newPassword;
    fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4));

    return 1;

}

//クッキーを使ったユーザー認証
let authUserBySession = function authUserBySession(cred:{
    userid: string,
    sessionid:string
}) {
    console.log("authUserBySession :: これから確認... -> ", cred);
    let userid = cred.userid;
    let sessionid = cred.sessionid;

    //セッションIDが一致してるなら
    try {
        if ( sessionid in dataUser.user[userid].state.sessions ) {
            //BANされているなら-1を返す
            if ( dataUser.user[userid].state.banned ) {
                return {result: false};

            }

            //セッションIDを更新
                //セッションID用に24文字のコードを生成
            let sessionidCharset:string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let sessionidLength:number = 24;
            let _sessionid:string = Array.from(Array(sessionidLength)).map(()=>sessionidCharset[Math.floor(Math.random()*sessionidCharset.length)]).join('');
                //セッションデータを記憶
            let currentSessionData = dataUser.user[userid].state.sessions[sessionid];
                //セッションデータをコピー
            dataUser.user[userid].state.sessions[_sessionid] = structuredClone(currentSessionData);
                //今までのセッションデータを削除
            delete dataUser.user[userid].state.sessions[sessionid];

            //セッションＩＤを更新
            sessionid = _sessionid;

            //ログイン時間を記録する用
            let t:Date = new Date();
            //ログイン時間(分まで)を変数へ格納
            let _loginTime = t.getFullYear() + (t.getMonth()+1).toString().padStart(2,0) + t.getDate().toString().padStart(2,0) + t.getHours().toString().padStart(2,0) + t.getMinutes().toString().padStart(2,0);
            //セッションIDを適用
            try {
                dataUser.user[userid].state.sessions[sessionid].loggedinTime = _loginTime;
            } catch (e) {
                console.log("auth :: authUserBySession : 記録エラー ユーザーセッションデータ->", dataUser.user[userid].state.sessions);
                console.log("auth :: authUserBySession : 記録エラー詳細->", e);
                
                return {result: false};
            }

            let username = dataUser.user[userid].name; //ユーザー名取得

            return {
                result: true, //ログイン成功の印
                userid: userid, //ユーザーID
                username: username, //ユーザー名
                sessionid: sessionid, //セッションコード
                role: dataUser.user[userid].role, //ロール
                channelJoined: dataUser.user[userid].channel //参加しているチャンネル
            }; //ユーザーの情報を送信

        }
    } catch(e) {}

    console.log("authUserByCookie :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false, userid:userid, username:null };

}

//ユーザーの新規登録、そしてパスワードを返す
let registerUser = async function registerUser(dat:{
    username: string,
    code: string,
}) { //dat=[0=>name(名前), 1=>key(招待コード)]
    //招待制だったらコードを確認
    if ( db.dataServer.registration.invite.inviteOnly && db.dataServer.registration.available ) { //招待制かどうか
        //招待コードが一致しているかどうか
        if ( db.dataServer.registration.invite.inviteCode !== dat.code ) {
            console.log("auth :: registerUser : 招待コード違うわ");
            return {result: "FAILED", pass:"", userid:""};

        }
        console.log("auth :: registerUser : 招待コード合ってる！");

    }

    //ID格納用
    let newID = "";
    //パスワードを生成
    const pwGenerated = generateKey();
    //DBに書くためにハッシュ化する
    const pwHashed = await bcrypt.hash(pwGenerated, 10);
    //setIntervalを格納する変数
    let CheckIDInterval:ReturnType<typeof setInterval>;

    //ユーザー名の空きを調べる
    for ( let index in dataUser.user ) {
        //ユーザー名がすでに使われていたら停止
        if ( dataUser.user[index].name === dat.username ) {
            return {result: "FAILED", pass:"", userid:""};

        }

    }

    //ユーザーIDの空きを調べて作る
    return new Promise<void>((resolve) => {
        CheckIDInterval = setInterval(() => {
            //ID用変数を初期化
            newID = "";
            //IDへ乱数生成して格納
            for ( let i=0; i<8; i++ ) {
                newID += Math.trunc(Math.random() * 9); //乱数を追加

            }

            //もし生成したIDが空いてるならここで次の処理へ
            if ( dataUser.user[newID] === undefined ) resolve();

        }, 10);

        
    }).then(() => {
        //IDの空き確認用Intervalを停止
        clearInterval(CheckIDInterval);

        //DBに登録
        dataUser.user[newID] = {
            "name": dat.username,
            "role": Object.keys(dataUser.user).length === 0?"Admin":"Member", //一番最初のユーザーならAdminとして登録
            "pw": pwHashed,
            "icon": "",
            "state": {
                "loggedin": false,
                "session_id": "",
                "sessions": {},
                "banned": false
            },
            "channel": db.dataServer.config.CHANNEL.CHANNEL_DEFAULT_JOINONREGISTER
        };

        console.log("registerUser :: 登録結果 ↓");
        console.log(dataUser.user[newID]);

        //サーバーのJSONファイルを更新
        fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4));

        //デフォルトアイコンを新規ユーザー用にクローン
        fs.copyFileSync("./img/default.jpeg", "./img/" + newID + ".jpeg");

        //パスワードを返す
        return {result: "SUCCESS", pass:pwGenerated, userid:newID};

    });

}

//セッションが適切かどうかを確認するだけの関数
export let checkUserSession = function checkUserSession(dat:{
    userid:string, sessionid:string
}) { //{userid="ユーザーID", sessionid="セッションのID"}
    try {
        //ID確認
        if (
            dat.sessionid in dataUser.user[dat.userid].state.sessions && //セッションIDがあって
            dataUser.user[dat.userid].state.banned === false //BANされていない
        ) {
            return true;

        } else { //IDが違う
            console.log("checkUserSession :: ///FALSE/// dat->" + dat.sessionid + "; DBsession_id->" + dataUser.user[dat.userid].state.session_id);
            return false;

        }
    }
    catch(e) {
        console.log("checkUserSession :: エラー発生 vvvvvvvvvvvvvv");
        console.log(dat);
        console.log(e);
        
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
    }

}

//パスワード生成
function generateKey(){
    const LENGTH = 24; //生成したい文字列の長さ
    const SOURCE = "abcdefghijklmnopqrstuvwxyz0123456789"; //元になる文字
    let result = "";

    for(let i=0; i<LENGTH; i++){
      result += SOURCE[Math.floor(Math.random() * SOURCE.length)];

    }

    return result;

}

exports.authUser = authUser; //ユーザーの認証
exports.changePassword = changePassword; //パスワード変更
exports.authUserBySession = authUserBySession; //クッキーによる認証
exports.checkUserSession = checkUserSession; //セッションIDの確認をするだけの関数
exports.registerUser = registerUser; //ユーザーの新規登録

