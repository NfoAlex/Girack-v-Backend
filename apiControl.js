const fs = require("fs");
const apiMan = require("./dbControl.js");
const db = require("./dbControl.js");

//APIデータのテンプレ
/*
{
    userid: 12345678,
    type: "user"|"bot",
    status: "active"|"pending"|"disabled",
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
    for ( let index in apiMan.dataAPI ) {
        if ( apiMan.dataAPI[index].userid === userid ) {
            //配列へ追加
            arrResult.push(apiMan.dataAPI[index]);

        }

    }

    //結果を返す
    return arrResult;

};

//API情報を生成する
const registerApi = function registerApi(dat) {
    //名前が空なら登録させない
    if ( dat.registerApiData.apiName === "" ) {
        return -1;
    }

    //登録するAPI情報
    const apiDataRegistering = {
        userid: dat.reqSender.userid,
        token: "",
        status: db.dataServer.config.API.API_NEEDAPPROVE?"pending":"disabled",
        apiName: dat.registerApiData.apiName,
        actionOnServer: dat.registerApiData.apiActionOnServer,
        actionPerChannel: {}
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
            if ( apiMan.dataAPI[randomIdGen] === undefined ) { //空いているなら
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
        let apiTokenLength = 24; //文字数
        _token = Array.from(Array(apiTokenLength)).map(()=>apiTokenCharset[Math.floor(Math.random()*apiTokenCharset.length)]).join('');
        //トークン割り当て
        apiDataRegistering.token = _token;

        //空いているIDに対してデータを格納
        apiMan.dataAPI[randomIdGen] = apiDataRegistering;
        fs.writeFileSync("./apiList.json", JSON.stringify(apiMan.dataAPI, null, 4));
        //ループ停止
        clearInterval(checkIdLoop);

    });

};

//API情報を削除する
const removeApi = function removeApi(dat) {

}

//エクスポート
exports.getApiList = getApiList;
exports.registerApi = registerApi;