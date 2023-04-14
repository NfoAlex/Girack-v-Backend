const fs = require('fs');

//ユーザーを記録しているJSONファイルを読み取る
let dataUser = {};
try { //読み込んでみる
    dataUser = JSON.parse(fs.readFileSync('./user.json', 'utf-8')); //ユーザーデータのJSON読み込み
} catch(e) {
    //最初のユーザー用のパスワードを生成
    const pwLength = 24; //生成したい文字列の長さ
    const pwSource = "abcdefghijklmnopqrstuvwxyz0123456789"; //元になる文字
    let pwGenResult = "";

    for(let i=0; i<pwLength; i++){
        pwGenResult += pwSource[Math.floor(Math.random() * pwSource.length)];

    }

    //初期のユーザーデータ
    let dataUserInitText = `
{
    "user":{
        "00000001": {
            "name": "Admin",
            "role": "Admin",
            "pw": "` + pwGenResult + `",
            "state": {
                "loggedin": false,
                "session_id": "",
                "banned": false
            },
            "channel": [
                "0001"
            ]
        }
    }
}`;

    fs.writeFileSync("./user.json", dataUserInitText); //JSONファイルを作成
    dataUser = JSON.parse(fs.readFileSync("./user.json", "utf-8")); //ユーザーデータのJSON読み込み
    
    console.log("***********************************");
    console.log("***********************************");
    console.log("Girackへようこそ!");
    console.log("次のユーザー情報でログインしてください。");
    console.log("\n");
    console.log("パスワード : " + pwGenResult)
    console.log("\n");
    console.log("***********************************");
    console.log("***********************************");
}

//サーバー情報や設定を記録しているJSONファイルを読み取る
let dataServer = {};
try { //読み込んでみる
    dataServer = JSON.parse(fs.readFileSync('./server.json', 'utf-8')); //サーバー情報のJSON読み込み
} catch(e) {
    //初期のサーバー情報
    let dataServerInitText = `
{
    "servername": "Girack",
    "registration": {
        "available": false,
        "invite": {
            "inviteOnly": false,
            "inviteCode": ""
        }
    },
    "channels": {
        "0001": {
            "name": "random",
            "description": "なんでも雑談",
            "scope": "public"
        }
    }
}`;

    fs.writeFileSync("./server.json", dataServerInitText); //JSONファイルを作成
    dataServer = JSON.parse(fs.readFileSync('./server.json', 'utf-8')); //サーバー情報のJSON読み込み
}


//let dataRole = JSON.parse(fs.readFileSync('./role.json', 'utf-8')); //ロールのJSON読み込み
//let dataFiles = JSON.parse(fs.readFileSync('./files.json', 'utf-8')); //ロールのJSON読み込み

//起動したときに全員をオフライン状態にする
for ( let index in Object.keys(dataUser.user) ) {
    let userid = Object.keys(dataUser.user)[index]; //ユーザーIDを取得
    dataUser.user[userid].state.loggedin = false; //オフラインと設定

}

console.log("=========================");
console.log("DB認識!");
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

//TODO : これを削除
//DBから必要な情報を用意
let parseInfos = function parseInfos(dat) { //i => {target, id}
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
    console.log("parseInfos :: 情報 ↓")
    console.log(dat);

    let infoParsed;

    //情報追加しまくり(user.jsonから)
    try {
        switch( dat.target ) {
            case "user":
                try{
                    //送信者自身の情報がほしかったら
                    if ( dat.targetid === dat.reqSender.userid ) {
                        infoParsed = {
                            type: "user",
                            username: dataUser.user[dat.targetid].name, //ユーザーの表示名
                            userid: dat.targetid,
                            channelJoined: dataUser.user[dat.targetid].channel, //入っているチャンネルリスト(array)
                            role: dataUser.user[dat.targetid].role, //ユーザーのロール
                            banned: dataUser.user[dat.targetid].state.banned //BANされているかどうか
                        }

                    } else { //他人の情報
                        infoParsed = {
                            type: "user",
                            username: dataUser.user[dat.targetid].name, //ユーザーの表示名
                            userid: dat.targetid,
                            role: dataUser.user[dat.targetid].role, //ユーザーのロール
                        }

                    }

                }
                catch(e) {
                    infoParsed = {
                        type: "user",
                        username: "存在しないユーザー", //ユーザーの表示名
                        userid: dat.targetid,
                        channelJoined: [], //入っているチャンネルリスト(array)
                        role: "Deleted", //ユーザーのロール
                        banned: false //BANされているかどうか
                    }
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

            case "list":
                if ( dat.targetlist === "channel" ) {
                    let cl = {};
                    let objServer = Object.entries(dataServer.channels)
                    for ( let i in objServer ) {
                        cl[objServer[i][0]] = objServer[i][1];

                    }

                    infoParsed = {
                        type: "list",
                        channelList: cl
                        
                    }
                
                }

                break;

            default:
                console.log("dbControl :: 何かあった...?");
                return -1;

        }
    }
    catch(e) {
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        console.log("   ERROR");
        console.log(e);
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");

        return -1;

    }

    return infoParsed;

}

//チャンネルリストの取得
let getInfoList = function getInfoList(dat) {
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

    //チャンネルリストをとる
    if ( dat.target === "channel" ) {
        let channelList = {};
        let objServer = Object.entries(dataServer.channels)

        //サーバーの情報分、転送する配列へ追加
        for ( let i in objServer ) {
            //Adminではなく、かつ参加していないならプライベートチャンネルをリストに追加しない
            if (
                objServer[i][1].scope !== "private" ||
                dataUser.user[dat.reqSender.userid].channel.includes(objServer[i][0]) ||
                dataUser.user[dat.reqSender.userid].role === "Admin" 
            ) {
                //転送する配列にチャンネル情報を追加
                channelList[objServer[i][0]] = objServer[i][1];

            }

        }

        //送る情報
        infoParsed = {
            type: "channel",
            channelList: channelList
        };
    
    }

    //ユーザーリストをとる
    if ( dat.target === "user" ) {
        let userList = [];
        let objUser = Object.entries(dataUser.user); //ユーザーのJSONデータをオブジェクト化

        //サーバーの情報分、転送する配列へ追加
        for ( let i in objUser ) {
            //転送する配列にユーザー情報をそれぞれ追加
            //userList[objUser[i][0]] = objUser[i][1];
            userList.push({
                userid: objUser[i][0],
                name: objUser[i][1].name,
                role: objUser[i][1].role,
                state: {
                    loggedin: objUser[i][1].state.loggedin,
                    banned: objUser[i][1].state.banned
                },
                channel: objUser[i][1].channel
            });

        }

        //送る情報
        infoParsed = {
            type: "user",
            userList: userList
        };
    
    }

    return infoParsed;

}

//ユーザー情報の取得
let getInfoUser = function getInfoUser(dat) {
    /*
    dat
    {
        *targetid: "ほしい人情報のID",
        -reqSender: {
            -userid: "このリクエストを送っているユーザーのID",
            -sessionid: "セッションID"
        },
    }
    */

    let infoParsed = {}; //収集した情報を入れる

    try{
        infoParsed = {
            username: dataUser.user[dat.targetid].name, //ユーザーの表示名
            userid: dat.targetid, //ユーザーID
            channelJoined: dataUser.user[dat.targetid].channel, //入っているチャンネルリスト(array)
            role: dataUser.user[dat.targetid].role, //ユーザーのロール
            loggedin: dataUser.user[dat.targetid].state.loggedin, //ユーザーがログインしている状態かどうか
            banned: dataUser.user[dat.targetid].state.banned //BANされているかどうか
        }

    }
    catch(e) {
        infoParsed = {
            username: "存在しないユーザー", //ユーザーの表示名
            userid: dat.targetid,
            channelJoined: [], //入っているチャンネルリスト(array)
            role: "Deleted", //ユーザーのロール
            loggedin: false,
            banned: false //BANされているかどうか
        }
        
    }

    return infoParsed;

}

//チャンネル情報の取得
let getInfoChannel = function getInfoChannel(dat) {
    let infoParsed = {};

    //情報収集
    try {
        infoParsed = {
            channelname: dataServer.channels[dat.targetid].name,
            channelid: dat.targetid,
            description: dataServer.channels[dat.targetid].description,
            scope: dataServer.channels[dat.targetid].scope
        }
    }
    catch(e) {
        //読み取れなかったら
        infoParsed = {
            channelname: "削除されたチャンネル",
            channelid: dat.targetid,
            description: "このチャンネルは削除されています。これが見えていたらおかしいよ。",
            scope: "deleted"
        }
    }

    return infoParsed;

}

//チャンネルに参加しているユーザーのリスト取得
let getInfoChannelJoinedUserList = function getInfoChannelJoinedUserList(dat) {
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
    let channelJoinedUserList = []; //送信予定の配列
    let objUser = Object.entries(dataUser.user); //JSONをオブジェクト化

    //情報収集
    for ( index in objUser ) {
        //ユーザー情報の中で指定のチャンネルに参加しているなら配列追加
        if ( objUser[index][1].channel.includes(dat.targetid) ) {
            //配列追加
            channelJoinedUserList.push({
                userid: objUser[index][0],
                username: objUser[index][1].name
            });

        }

    }

    return channelJoinedUserList;

}

//ユーザーを検索する関数
let searchUserDynamic = function searchUserDynamic(dat) {
    /*
    dat
    {
        query: this.userSearchQuery,
        reqSender: {
            ...
        }
    }
    */

    let searchResult = []; //検索結果を入れる配列
    let objUser = Object.entries(dataUser.user);

    //検索開始
    for ( index in objUser ) {
        if ( objUser[index][1].name.includes(dat.query) ) {
            searchResult.push({
                userid: objUser[index][0],
                username: objUser[index][1].name,
            });

        }

    }

    return searchResult;

}

//サーバーの設定情報を取得
let getServerSettings = function getServerSettings(dat) {
    let sendersInfo = getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    //権限チェック
    if ( sendersInfo.role !== "Admin" ) { return; }

    //情報収集、設定
    let ServerSettings = {
        servername: dataServer.servername,
        registration: dataServer.registration
    };

    return ServerSettings;

}

//サーバーの初期情報を取得する
let getInitInfo = function getInitInfo() {
    return {
        servername: dataServer.servername, //サーバー名
        registerAvailable: dataServer.registration.available, //登録可能かどうか
        inviteOnly: dataServer.registration.invite.inviteOnly,
        serverVersion: "..." //招待制かどうか
    };
}

exports.findUserName = findUserName; //ユーザー名で情報を探す
exports.parseInfos = parseInfos; //IDで情報を取得(ToDo削除)
exports.getInfoUser = getInfoUser; //ユーザー情報を取得
exports.getInfoChannel = getInfoChannel; //チャンネル情報を取得
exports.getInfoChannelJoinedUserList = getInfoChannelJoinedUserList; //チャンネルに参加したユーザーのリスト取得
exports.getInfoList = getInfoList; //チャンネルリストの取得
exports.searchUserDynamic = searchUserDynamic; //ユーザーを検索する関数
exports.getServerSettings = getServerSettings; //サーバーの詳細設定を取得
exports.getInitInfo = getInitInfo; //サーバーの初期情報

exports.dataServer = dataServer; //サーバー情報
exports.dataUser = dataUser; //ユーザー情報