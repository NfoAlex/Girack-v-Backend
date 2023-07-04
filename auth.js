//auth.js

const fs = require('fs'); //履歴書き込むため
let db = require("./dbControl.js");

//ユーザー認証
let authUser = function authUser(cred) {
    console.log("authUser :: これから確認...");
    
    //データからユーザー名とパスワードを抽出
    let username = cred.username;
    let password = cred.password;

    //それぞれのユーザーリストの中でパスワードが一致しているやつを探す
    for (let i=0; i<Object.keys(db.dataUser.user).length; i++ ) {
        //ユーザーIDを巡回
        let index = Object.keys(db.dataUser.user)[i];

        //ユーザー名とパスワードの一致を確認してセッションIDを生成する
        if (
            db.dataUser.user[index].name === username &&
            db.dataUser.user[index].pw === password
        ) {
            let _session = "";

            //BANされているならそう結果を返す
            if ( db.dataUser.user[index].state.banned ) {
                return {result: false};

            }

            //セッションID用に８桁のコードを生成
            for ( let i=0; i<8; i++ ) {
                _session += parseInt(Math.random() * 9); //乱数を追加

            }

            let username = db.dataUser.user[index].name; //ユーザー名取得

            db.dataUser.user[index].state.session_id = _session; //セッションコードを取得
            
            //サーバーのJSONファイルを更新
            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));
            
            return {
                result: true, //ログイン成功の印
                userid: index, //ユーザーID
                username: username, //ユーザー名
                sessionid: _session, //セッションコード
                role: db.dataUser.user[index].role, //ロール
                channelJoined: db.dataUser.user[index].channel //参加しているチャンネル
            }; //ユーザーの情報を送信

        }

    }

    console.log("authUser :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false };

}

//パスワードを変更
let changePassword = function changePassword(dat) {
    //今のパスワードが一致しないならここで停止
    if ( db.dataUser.user[dat.reqSender.userid].pw !== dat.currentPassword ) return -1;

    //パスワード変更
    db.dataUser.user[dat.reqSender.userid].pw = dat.newPassword;
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

    return 1;

}

//クッキーを使ったユーザー認証
let authUserByCookie = function authUserByCookie(sessionid) {
    console.log("authUserByCookie :: これから確認... -> " + sessionid);
    //ユーザーDBから検索
    for (let i=0; i<Object.keys(db.dataUser.user).length; i++ ) {
        let index = Object.keys(db.dataUser.user)[i];
        
        //パスワードを確認してデータを返す
        try {
            if ( db.dataUser.user[index].state.session_id === sessionid ) {
                console.log("authUserByCookie :: " + db.dataUser.user[index].name + "としてユーザー認証");

                //BANされているなら-1を返す
                if ( db.dataUser.user[index].state.banned ) {
                    return {result: false};

                }
                let username = db.dataUser.user[index].name; //ユーザー名取得

                return {
                    result: true, //ログイン成功の印
                    userid: index, //ユーザーID
                    username: username, //ユーザー名
                    sessionid: sessionid, //セッションコード
                    role: db.dataUser.user[index].role, //ロール
                    channelJoined: db.dataUser.user[index].channel //参加しているチャンネル
                }; //ユーザーの情報を送信

            }
        }
        catch (e) {}

    }

    console.log("authUserByCookie :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false, userid:null, username:null, id:null };

}

//ユーザーの新規登録、そしてパスワードを返す
let registerUser = function registerUser(dat) { //dat=[0=>name(名前), 1=>key(招待コード)]
    //招待制だったらコードを確認
    if ( db.dataServer.registration.invite.inviteOnly && db.dataServer.registration.available ) { //招待制かどうか
        //招待コードが一致しているかどうか
        if ( db.dataServer.registration.invite.inviteCode !== dat[1] ) {
            console.log("auth :: registerUser : 招待コード違うわ");
            return -1;

        }
        console.log("auth :: registerUser : 招待コード合ってる！");

    }

    //ID格納用
    let newID = "";
    //ID生成
    for ( let i=0; i<8; i++ ) {
        newID += Math.trunc(Math.random() * 9); //乱数を追加

    }

    //DBに登録
    db.dataUser.user[newID] = {
        "name": dat[0],
        "role": "Member",
        "pw": generateKey(),
        "icon": "",
        "state": {
            "loggedin": false,
            "session_id": "",
            "banned": false
        },
        "channel": [
            "0001"
        ]
    };

    console.log("registerUser :: 登録結果 ↓");
    console.log(db.dataUser.user[newID]);

    //サーバーのJSONファイルを更新
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

    //デフォルトアイコンを新規ユーザー用にクローン
    fs.copyFileSync("./img/default.jpeg", "./img/" + newID + ".jpeg");

    //パスワードを返す
    return db.dataUser.user[newID].pw;

}

//セッションが適切かどうかを確認するだけの関数
let checkUserSession = function checkUserSession(dat) { //{userid="ユーザーID", sessionid="セッションのID"}
    //console.log("checkUserSession :: dat->" + dat.sessionid + "; DBsession_id->" + dataUser.user[dat.userid].state.session_id);
    try {
        if (
            db.dataUser.user[dat.userid].state.session_id === dat.sessionid && //セッションIDが一致していて
            db.dataUser.user[dat.userid].state.banned === false //BANされていない
        ) { //IDが合ってる
            //console.log("checkUserSession :: !!!TRUE!!! dat->" + dat.sessionid + "; DBsession_id->" + db.dataUser.user[dat.userid].state.session_id);
            return true;

        } else { //IDが違う
            console.log("checkUserSession :: ///FALSE/// dat->" + dat.sessionid + "; DBsession_id->" + db.dataUser.user[dat.userid].state.session_id);
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
exports.authUserByCookie = authUserByCookie; //クッキーによる認証
exports.checkUserSession = checkUserSession; //セッションIDの確認をするだけの関数
exports.registerUser = registerUser; //ユーザーの新規登録

