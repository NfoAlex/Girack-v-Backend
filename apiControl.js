const fs = require("fs");
const db = require("./dbControl.js");

//APIデータのテンプレ
/*
{
    userid: 12345678,
    type: "user"|"bot",
    status: {
        active: false,
        approved: true
    },
    apiName: "",
    actionOnServer: {
        USER_GETINFO: false,
        CHANNEL_GETINFO: true,
        CHANNEL_GETLIST: false
    },
    actionPerChannel: {
        "0001": {
            MESSAGE_TALK: false,
            MESSAHE_READ: true
        },
        "1234": {
            MESSAGE_TALK: true,
            MESSAGE_READ: true
        }
    }
}
*/

//API情報を取得する
const getApiList = function getApiList(userid) {
    //結果を入れる配列
    let arrResult = [];
    //APIの数分ループしてユーザーIDが同じものを探す
    for ( let index in db.dataAPI ) {
        if ( db.dataAPI[index].userid === userid ) {
            //配列へ追加
            arrResult.push(db.dataAPI[index]);

        }

    }

    //結果を返す
    return arrResult;

};

//API情報を登録、生成する
const registerApi = function registerApi(dat) {
    //名前が空なら登録させない
    if ( dat.registerApiData.apiName === "" ) {
        return -1;

    }

    //APIの状態設定用
    let approveStatus = "";
    //ロールとAPI利用が可能かどうか確認
    if ( db.dataUser.user[dat.reqSender.userid].role === "Admin" ) { //Admin?
        approveStatus = true;

    } else if (
        db.dataServer.config.API.API_ENABLED
            &&
        (
            db.dataServer.config.API.API_CANREGISTER_ROLE === "Moderator"
                &&
            db.dataUser.user[dat.reqSender.userid].role !== "Member"
        )
            ||
        db.dataServer.config.API.API_CANREGISTER_ROLE === "Member"
    ) { //APIが使えるという設定？
        //許可制ならfalseにして承認待ち、そうじゃないなら承認された状態にする
        approveStatus = db.dataServer.config.API.API_NEEDAPPROVE?false:true;

    } else { //設定が無効なら
        return -1;

    }

    //登録するAPI情報
    const apiDataRegistering = {
        userid: dat.reqSender.userid, //登録するユーザーID
        token: "", //トークン
        type: dat.registerApiData.type, //bot or user
        status: {
            active: false,
            approved: true
        },
        apiName: dat.registerApiData.apiName, //登録名
        actionOnServer: dat.registerApiData.apiActionOnServer, //サーバーに関してできること
        actionPerChannel: {} //チャンネルそれぞれに対してできること
    };

    let checkIdLoop; //ループ関数格納用変数
    //空いているIDを探す
    return new Promise((resolve) => {
        //ループを繰り返した数
        let loopCount = 0;

        //見つかるまでループして探し、見つかったらループ終わり(あるいは１０回試しても無理なら)
        checkIdLoop = setInterval(() => {
            //乱数格納用
            let randomIdGen = "";
            //ID用の乱数生成
            for ( let i=0; i<8; i++ ) {
                //乱数生成
                let n = Math.floor(Math.random() * 9);
                //IDへ追加する
                randomIdGen += (n).toString();

            }

            console.log("apiControl :: registerApi : randomIdGen->", randomIdGen);

            //生成したIDの部分が空いているかどうか
            if ( db.dataAPI[randomIdGen] === undefined ) { //空いているなら
                //API情報の登録処理へ
                resolve(randomIdGen);

            }

            //10回以上繰り返しているなら止める
            if ( loopCount >= 10 ) {
                console.log("apiControl :: registerApi : 無理");
                clearInterval(checkIdLoop);
            }

            //ループ回数カウント
            loopCount++;

        }, 100);

    }).then((randomIdGen) => { //空いているIDが見つかったら
        //APIトークン用に24文字のコードを生成
        let apiTokenCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let apiTokenLength = 48; //文字数
        _token = Array.from(Array(apiTokenLength)).map(()=>apiTokenCharset[Math.floor(Math.random()*apiTokenCharset.length)]).join('');
        //トークン割り当て
        apiDataRegistering.token = _token;

        //空いているIDに対してデータを格納、JSON書き込み
        db.dataAPI[randomIdGen] = apiDataRegistering;
        fs.writeFileSync("./apiList.json", JSON.stringify(db.dataAPI, null, 4));
        //ループ停止
        clearInterval(checkIdLoop);

    });

};

//APIアクセスを削除する
const removeApi = function removeApi(dat) {
    //そもそもデータがないなら停止
    if ( db.dataAPI[dat.apiId] === undefined ) return -1;

    //ユーザーIDが同じか確認
    if ( db.dataAPI[dat.apiId].userid === dat.reqSender.userid) {
        //APIデータを削除、JSON書き込み
        delete db.dataAPI[dat.apiId];
        fs.writeFileSync("./apiList.json", JSON.stringify(db.dataAPI, null, 4));
    }
};

//APIの有効化(登録を許可)
const activateApi = function activateApi(dat) {
    //そもそもデータがないなら停止
    if ( db.dataApi[dat.apiId] === undefined ) return -1

    //AdminかどうかとユーザーIDを確認
    if (
        //APIが有効かどうか
        db.dataServer.config.API.API_ENABLED
            &&
        //Adminなら誰でも許可する
        db.dataUser.user[dat.reqSender.userid].role === "Admin"
            ||
        (
            //ユーザーIDの確認と承認済みかどうかの確認
            dat.reqSender.userid === db.dataApi[dat.apiId].userid
                &&
            db.dataApi[dat.apiId].status.approved
        )
    ) {
        //有効と設定してJSON書き込み
        db.dataApi[dat.apiId].status.active = true;
        fs.writeFileSync("./apiList.json", JSON.stringify(db.dataAPI, null, 4));

    }
    
};

//APIの無効化(登録を許可)
const disableApi = function disableApi(dat) {
    //そもそもデータがないなら停止
    if ( db.dataApi[dat.apiId] === undefined ) return -1
    
    //AdminかどうかとユーザーIDを確認
    if (
        //Adminなら誰でも許可する
        db.dataUser.user[dat.reqSender.userid].role === "Admin"
            ||
        //ユーザーIDの確認
        dat.reqSender.userid === db.dataApi[dat.apiId].userid
    ) {
        //無効と設定してJSON書き込み
        db.dataApi[dat.apiId].status.active = false;
        fs.writeFileSync("./apiList.json", JSON.stringify(db.dataAPI, null, 4));

    }
    
};

//エクスポート
exports.getApiList = getApiList;
exports.registerApi = registerApi;
exports.removeApi = removeApi;
exports.activateApi = activateApi;
exports.disableApi = disableApi;