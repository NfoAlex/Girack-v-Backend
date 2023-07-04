//auth.js

const fs = require('fs'); //履歴書き込むため
const bcrypt = require("bcrypt"); //ハッシュ化用
let db = require("./dbControl.js");

//ユーザー認証
let authUser = async function authUser(cred) {
    console.log("authUser :: これから確認...");

    //データからユーザー名とパスワード(ハッシュ化)を抽出
    let username = cred.username;
    let password = await bcrypt.hash(cred.password,10);

    console.log("auth :: authUser : ハッシュ化したpw->", password);

    //それぞれのユーザーリストの中でパスワードが一致しているやつを探す
    for (let i=0; i<Object.keys(db.dataUser.user).length; i++ ) {
        //ユーザーIDを巡回
        let index = Object.keys(db.dataUser.user)[i];

        //ユーザー名とパスワードの一致を確認してセッションIDを生成する
        if (
            db.dataUser.user[index].name === username &&
            (
                db.dataUser.user[index].pw === password ||
                db.dataUser.user[index].pw === cred.password //ハッシュ化前のも調べる、そしてハッシュ化する(次期ビルドで削除)
            )
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

            // !!!! ↓↓次期ビルドで削除↓↓ !!!!
            //パスワードが平文保存されているならハッシュ化して保存
            if ( db.dataUser.user[index].pw === cred.password ) {
                db.dataUser.user[index].pw = await bcrypt.hash(cred.password, 10);

            }
            
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
let authUserBySession = function authUserBySession(cred) {
    console.log("authUserBySession :: これから確認... -> ", cred);
    let userid = cred.userid;
    let sessionid = cred.sessionid;

    //セッションIDが一致してるなら
    if ( db.dataUser.user[userid].state.session_id === sessionid ) {
        //BANされているなら-1を返す
        if ( db.dataUser.user[userid].state.banned ) {
            return {result: false};

        }

        let username = db.dataUser.user[userid].name; //ユーザー名取得

        return {
            result: true, //ログイン成功の印
            userid: userid, //ユーザーID
            username: username, //ユーザー名
            sessionid: sessionid, //セッションコード
            role: db.dataUser.user[userid].role, //ロール
            channelJoined: db.dataUser.user[userid].channel //参加しているチャンネル
        }; //ユーザーの情報を送信

    }

    console.log("authUserByCookie :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false, userid:userid, username:null };

}

//ユーザーの新規登録、そしてパスワードを返す
let registerUser = async function registerUser(dat) { //dat=[0=>name(名前), 1=>key(招待コード)]
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

    //パスワードを生成
    const pwGenerated = generateKey();
    //DBに書くためにハッシュ化する
    const pwHashed = await bcrypt.hash(pwGenerated, 10);

    //DBに登録
    db.dataUser.user[newID] = {
        "name": dat[0],
        "role": "Member",
        "pw": pwHashed,
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
    return pwGenerated;

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
exports.authUserBySession = authUserBySession; //クッキーによる認証
exports.checkUserSession = checkUserSession; //セッションIDの確認をするだけの関数
exports.registerUser = registerUser; //ユーザーの新規登録

