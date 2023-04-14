//db.cjs
//データベース関連

const fs = require('fs');

let dataUser = JSON.parse(fs.readFileSync('./user.json', 'utf-8')); //ユーザーデータのJSON読み込み
let dataServer = JSON.parse(fs.readFileSync('./server.json', 'utf-8')); //サーバー情報のJSON読み込み
//let dataMsg = JSON.parse(fs.readFileSync('./msg.json', 'utf-8')); //メッセージデータのJSON読み込み

console.log("=========================");
console.log(" ユーザーのデータの型 => " + typeof(dataUser));
console.log(" ユーザーのデータ ↓");
console.log(dataUser);
console.log("=========================");

console.log("=========================");
console.log(" サーバーのデータの型 => " + typeof(dataServer));
console.log(" ユーザーのデータ ↓");
console.log(dataServer);
console.log("=========================");

//名前からユーザーのインデックス番号を返す
let findUserName = function findUserName(u) { //u => ユーザー名
    console.log("findUser :: 確認 => " + u + "?");
    for (let i=1; i<=Object.keys(dataUser.user).length; i++ ) {
        if ( dataUser.user[i].name == u ) {
            console.log("findUser :: ユーザー発見");
            return i; //ユーザーのインデックス番号を返す

        }

    }

    //ユーザーが見つからなければ
    return 0;

}

//IDからユーザー情報を探して返す
let findUserId = function findUserId(id) { //id => ユーザーid
    console.log("findUserId :: 確認 =>" + id + "?");
    for (let i=0; i<=Object.keys(dataUser.user).length; i++ ) {
        if ( Object.keys(dataUser.user)[i] == id ) {
            console.log("findUserId :: ユーザー発見");
            //ユーザーのインデックス番号を返す
            return {
                username: dataUser.user[id].name,
                userid: id,
                sessionid: dataUser.user[id].state.session_id
            }

        }

    }

    //ユーザーが見つからなければ
    return 0;

}

//DBから必要な情報を用意
let parseInfos = function parseInfos(dat) { //i => {target, id}
    console.log("parseInfos :: 情報 ↓")
    console.log(dat);

    let infoParsed;

    //情報追加しまくり(user.jsonから)
    try {
        switch( dat.target ) {
            case "user":
                infoParsed = {
                    type: "user",
                    username: dataUser.user[dat.targetid].name, //ユーザーの表示名
                    userid: dat.targetid,
                    channelJoined: dataUser.user[dat.targetid].channel, //入っているチャンネルリスト(array)
                    role: dataUser.user[dat.targetid].role, //ユーザーのロール
                    banned: dataUser.user[dat.targetid].state.banned //BANされているかどうか
                }
                break;

            case "channel":
                infoParsed = {
                    type: "channel",
                    channelname: dataServer.channels[dat.targetid].name,
                    channelid: dat.targetid,
                    description: dataServer.channels[dat.targetid].description,
                    scope: dataServer.channels[dat.targetid].scope
                }
                break;

            default:
                return 0;

        }
    }
    catch(e) {
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        console.log("   ERROR");
        console.log(e);
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
    }

    return infoParsed;

}

//ユーザー認証
let authUser = function authUser(key) {
    console.log("authUser :: これから確認...");
    for (let i=0; i<Object.keys(dataUser.user).length; i++ ) {
        let index = Object.keys(dataUser.user)[i];
        
        //パスワードを確認してデータを返す
        if ( dataUser.user[index].pw == key ) {
            console.log("authUser :: " + dataUser.user[index].name + "としてユーザー認証");
            let _session = "";

            //BANされているなら-1を返す
            if ( dataUser.user[index].state.banned ) {
                return {result: false};

            }

            //セッションID用に８桁のコードを生成
            for ( let i=0; i<8; i++ ) {
                _session += parseInt(Math.random() * 9); //乱数を追加

            }

            let username = dataUser.user[index].name; //ユーザー名取得

            dataUser.user[index].state.session_id = _session; //セッションコードを取得
            
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

    console.log("authUser :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false, userid:null, username:null, id:null };

}

//クッキーを使ったユーザー認証
let authUserByCookie = function authUserByCookie(sessionid) {
    console.log("authUserByCookie :: これから確認... -> " + sessionid);
    for (let i=0; i<Object.keys(dataUser.user).length; i++ ) {
        let index = Object.keys(dataUser.user)[i];
        
        //パスワードを確認してデータを返す
        if ( dataUser.user[index].state.session_id === sessionid ) {
            console.log("authUserByCookie :: " + dataUser.user[index].name + "としてユーザー認証");

            //BANされているなら-1を返す
            if ( dataUser.user[index].state.banned ) {
                return {result: false};

            }

            // //セッションID用に８桁のコードを生成
            // for ( let i=0; i<8; i++ ) {
            //     _session += parseInt(Math.random() * 9); //乱数を追加

            // }

            let username = dataUser.user[index].name; //ユーザー名取得

            //dataUser.user[index].state.session_id = _session; //セッションコードを取得
            
            //サーバーのJSONファイルを更新
            //fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4));
            
            return {
                result: true, //ログイン成功の印
                userid: index, //ユーザーID
                username: username, //ユーザー名
                sessionid: sessionid, //セッションコード
                role: dataUser.user[index].role, //ロール
                channelJoined: dataUser.user[index].channel //参加しているチャンネル
            }; //ユーザーの情報を送信

        }

    }

    console.log("authUserByCookie :: ユーザー認証できなかった");
    //ユーザーが見つからなければ
    return { result:false, userid:null, username:null, id:null };

}

//セッションが適切かどうかを確認するだけの関数
let checkUserSession = function checkUserSession(dat) { //{userid="ユーザーID", sessionid="セッションのID"}
    //console.log("checkUserSession :: dat->" + dat.sessionid + "; DBsession_id->" + dataUser.user[dat.userid].state.session_id);
    if ( dataUser.user[dat.userid].state.session_id === dat.sessionid ) { //IDが合ってる
        console.log("checkUserSession :: !!!TRUE!!! dat->" + dat.sessionid + "; DBsession_id->" + dataUser.user[dat.userid].state.session_id);
        return true;

    } else { //IDが違う
        console.log("checkUserSession :: ///FALSE/// dat->" + dat.sessionid + "; DBsession_id->" + dataUser.user[dat.userid].state.session_id);
        return false;
    }

}

//ユーザーの新規登録、そしてパスワードを返す
let registerUser = function registerUser(dat) { //dat=[0=>name(名前), 1=>key(招待コード)]
    //招待制だったらコードを確認
    if ( dataServer.registration.invite.inviteOnly ) { //招待制かどうか
        if ( dataServer.registration.invite.inviteCode !== dat[1] ) { //招待コードが一致しているかどうか
            console.log("registerUser :: 招待コード違うわ");
            return -1;

        }
        console.log("registerUser :: 招待コード合ってる！");

    }

    let newID = "";
    for ( let i=0; i<8; i++ ) {
        newID += parseInt(Math.random() * 12); //乱数を追加

    }

    //DBに登録
    dataUser.user[newID] = {
        "name": dat[0],
        "role": "Member",
        "pw": generateKey(),
        "icon": "",
        "state": {
            "loggedin": false,
            "session_id": ""
        },
        "channel": [
            "001"
        ]
    };

    console.log("registerUser :: 登録結果 ↓");
    console.log(dataUser.user[newID]);

    //サーバーのJSONファイルを更新
    fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4));

    //デフォルトアイコンを新規ユーザー用にクローン
    fs.copyFileSync("./img/default.jpeg", "./img/" + newID + ".jpeg");

    return dataUser.user[newID].pw;

}

//ユーザーの情報更新とか
let config = function config(dat) {
    let answer;
    console.log("config :: データ更新↓");
    console.log(dat);

    //変更したいデータの型合わせて更新、そしてそのデータを転送
    switch( dat.TargetType ) {
        //ユーザーの情報を変更する
        case "user":
            dataUser.user[dat.TargetID].name = dat.Name; //DB更新
            answer = parseInfos({target:"user", id:dat.TargetID}); //更新したデータを収集
            fs.writeFileSync("./user.json", JSON.stringify(dataUser, null, 4)); //DBをリモート保存

            return answer;

        //チャンネル情報とか設定を変える
        case "channel":
            console.log("channel...");
            break;

        //サーバーの情報とか設定を変える
        case "server":
            console.log("Server...");
            break;

        Default:
            return 0;

    }

}

//メッセージの履歴を保存
let msgRecord = function msgRecord(json) {
    let isExist = false; //JSONファイルが存在しているかどうか
    
    let t = new Date(); //履歴に時間を追加する用
    let time = t.getFullYear() + "_" +  (t.getMonth()+1) + "_" +  t.getDate();
    let receivedTime = [json.time, t.getMilliseconds() ].join("");

    //メッセージを送るチャンネルの履歴データのディレクトリ
    let pathOfJson = "./record/" + json.channelid + "/" + time + ".json";
    
    //JSONファイルを開いてみて、いけたらそのまま読み込み、なかったら作る
    try {
        fs.statSync(pathOfJson);
        isExist = true;

    } catch(err) {
        isExist = false;
        //ディレクトリもトライ
        try{fs.mkdirSync("./record/" + json.channelid);}catch(e){}
        fs.writeFileSync(pathOfJson, "{}"); //DBをリモート保存

    }

    let dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8')); //メッセージデータのJSON読み込み
    let latestMessage = []; //履歴の最後
    // console.log("最後の履歴のはず↓");
    // console.log(latestMessage);
    //ひとつ前と同じ送信者なら本文用配列へ追加
    try {
        latestMessage = Object.entries(dataHistory)[Object.entries(dataHistory).length-1][1];
        if ( latestMessage.userid === json.userid ) {
            Object.entries(dataHistory)[Object.entries(dataHistory).length-1][1].content.push(json.content);
            Object.entries(dataHistory)[Object.entries(dataHistory).length-1][1].time = json.time;

        } else {
            //データ追加
            dataHistory[[receivedTime,json.messageid].join("")] = { //JSONでの順番はキーでソートされるから時間を最初に挿入している
                //type: json.type,
                userid: json.userid,
                channelid: json.channelid,
                //time: receivedTime,
                time: json.time,
                content: [json.content]
            };

        }
    }
    catch(e) {
        dataHistory[[receivedTime,json.messageid].join("")] = { //JSONでの順番はキーでソートされるから時間を最初に挿入している
            //type: json.type,
            userid: json.userid,
            channelid: json.channelid,
            //time: receivedTime,
            time: json.time,
            content: [json.content]
        };
    }

    //JSON書き込み保存
    console.log("msgRecord :: 4");
    //fs.writeFileSync(pathOfJson, JSON.stringify(dataHistorySorted, null, 4));
    fs.writeFileSync(pathOfJson, JSON.stringify(dataHistory, null, 4));

    console.log("msgRecord :: jsonファイルが -> " + isExist + " , " + dataHistory);

}

//メッセージ履歴を最新から順に範囲分返す
let msgRecordCall = function msgRecordCall(cid, readLength) { //cid=>チャンネルID, readLength=>ほしい履歴の長さ(範囲)
    //履歴を返すための配列
    let dat = [];

    //履歴に時間を追加する用
    let t = new Date();
    let time = t.getFullYear() + "_" +  (t.getMonth()+1) + "_" +  t.getDate();

    //ファイルのパス
    let pathOfJson = "./record/" + cid + "/" + time + ".json";
    
    //メッセージデータのJSON読み込み用
    let dataHisotry = "";

    //履歴データ
    try{
        dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8'));
    
    }
    catch(e) {
        console.log("msgRecordCall ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        console.log(e);

        return 0;

    }

    //もしほしいデータの範囲が履歴の長さを超えていたら、ほしいデータ範囲をその長さにする
    if ( readLength > Object.entries(dataHistory).length ) { //でかい？
        readLength = Object.entries(dataHistory).length; //設定

    }

    //履歴を古い分から順番にJSONへ追加
    for ( let i=readLength; i>0; i-- ) {
        //履歴をJSONへ追加
        dat.push(
            Object.entries(dataHistory)[Object.entries(dataHistory).length-i][1]
        );

    }

    return dat;

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

//関数
exports.findUserName = findUserName; //見つかったユーザーの情報
exports.findUserId = findUserId; //見つかったユーザーの情報
exports.parseInfos = parseInfos; //ユーザーの情報を伝達(多分使わない)
exports.authUser = authUser; //ユーザーの認証
exports.authUserByCookie = authUserByCookie; //クッキーによる認証
exports.checkUserSession = checkUserSession; //セッションIDの確認をするだけの関数
exports.registerUser = registerUser; //ユーザーの新規登録
exports.config = config; //データ更新
exports.msgRecord = msgRecord; //メッセージ履歴の保存
exports.msgRecordCall = msgRecordCall; //メッセージ履歴の取り出し

//変数
exports.dataServer = dataServer;
exports.dataUser = dataUser;