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

    //生成
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
    
    //初回起動時にログインを促すためのメッセージ
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
let dataServerInitText = `
{
    "servername": "Girack",
    "registerAnnounceChannel": "0001",
    "defaultJoinChannels": ["0001"],
    "registration": {
        "available": false,
        "invite": {
            "inviteOnly": false,
            "inviteCode": ""
        }
    },
    "config": {
        "PROFILE": {
            "PROFILE_ICON_MAXSIZE": "1e6",
            "PROFILE_USERNAME_MAXLENGTH": "32"
        },
        "CHANNEL": {
            "CHANNEL_CREATE_AVAILABLE": true,
            "CHANNEL_DELETE_AVAILABLEFORMEMBER": true,
            "CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER": false
        },
        "MESSAGE": {
            "MESSAGE_TXT_MAXLENGTH": "250",
            "MESSAGE_FILE_MAXSIZE": "5e7"
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
try { //読み込んでみる
    //serverデータを読み取り
    let dataServerLoaded = JSON.parse(fs.readFileSync('./server.json', 'utf-8')); //サーバー情報のJSON読み込み
    //テンプレに上書きする感じでサーバー情報を取り込む
    dataServer = {...JSON.parse(dataServerInitText), ...dataServerLoaded};
    //この時点で一度書き込み保存
    fs.writeFileSync("./server.json", JSON.stringify(db.dataServer, null, 4));
} catch(e) {
    //初期のサーバー情報
    fs.writeFileSync("./server.json", dataServerInitText); //JSONファイルを作成
    dataServer = JSON.parse(fs.readFileSync('./server.json', 'utf-8')); //サーバー情報のJSON読み込み
}

//起動したときに全員をオフライン状態にする
for ( let index in Object.keys(dataUser.user) ) {
    let userid = Object.keys(dataUser.user)[index]; //ユーザーIDを取得
    dataUser.user[userid].state.loggedin = false; //オフラインと設定

}

console.log("=========================");
console.log("DB認識!");
console.log("=========================");

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
    let targetChannelJoined = []; //チャンネル参加リスト。プライベートは隠す処理をするため予め変数を設定

    //システムメッセージ用の返答
    if ( dat.targetid === "SYSTEM" ) {
        return {
            username: "SYSTEM", //ユーザーの表示名
            userid: "SYSTEM",
            channelJoined: [], //入っているチャンネルリスト(array)
            role: "SYSTEM", //ユーザーのロール
            loggedin: false,
            banned: false //BANされているかどうか
        };

    }

    try{
        dataUser.user[dat.targetid].channel;
        if ( dataUser.user[dat.targetid] === undefined ) throw err;
    } catch(e) {
        console.log("dbControl :: getInfoUser : ユーザーデータを読み取れませんでした->", e);
        return {
            username: "存在しないユーザー", //ユーザーの表示名
            userid: dat.targetid,
            channelJoined: [], //入っているチャンネルリスト(array)
            role: "Deleted", //ユーザーのロール
            loggedin: false,
            banned: false //BANされているかどうか
        };
    }

    //もし送信者が同じか権限によって渡すチャンネル参加リストを変える
    if ( dat.reqSender.userid === dat.targetid || dataUser.user[dat.reqSender.userid].role === "Admin" ) {
        targetChannelJoined = dataUser.user[dat.targetid].channel;

    } else { //リクエスト送信者が通常メンバーならプライベートチャンネルを隠す(送信者が参加していた場合をのぞく)
        //送信者の参加チャンネルリストを取得
        let reqSenderInfoChannelJoined = dataUser.user[dat.reqSender.userid].channel;

        //ターゲットユーザーの参加チャンネルリスト分、送れる情報か確認する
        for ( let index in dataUser.user[dat.targetid].channel ) {
            //チャンネルIDを取り出す
            let checkingChannelid =  dataUser.user[dat.targetid].channel[index];

            //チャンネルがプライベートなら送信者が参加しているかを確認してから追加
            if (
                dataServer.channels[checkingChannelid].scope !== "private" ||
                reqSenderInfoChannelJoined.includes(checkingChannelid)
            ) {
                targetChannelJoined.push(checkingChannelid);

            }

        }

    }

    try{
        infoParsed = {
            username: dataUser.user[dat.targetid].name, //ユーザーの表示名
            userid: dat.targetid, //ユーザーID
            channelJoined: targetChannelJoined, //入っているチャンネルリスト(array)
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

//ユーザー本人のセッションデータを取得
let getInfoSessions = function getInfoSessions(dat) {
    /*
    dat
    {
        reqSenderだけ
    }
    */

    return dataUser.user[dat.reqSender.userid].state.sessions;

}

//チャンネル情報の取得
let getInfoChannel = function getInfoChannel(dat) {
    let infoParsed = {};

    //権限チェックのためにユーザー情報を取得
    let reqSenderInfo = getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    //情報収集
    try {
        //もしユーザーがメンバーなのにプライベートチャンネルを取得しようとしているなら空データを返す
        if (
            reqSenderInfo.role !== "Admin" &&
            dataServer.channels[dat.targetid].scope === "private" &&
            !reqSenderInfo.channelJoined.includes(dat.targetid)
        ) {
            infoParsed = {
                channelid: dat.targetid,
                channelname: "存在しないチャンネル",
                channelid: dat.targetid,
                description: "このチャンネルの情報がありません。これが見えていたらおかしいよ。",
                scope: "deleted"
            };

            return infoParsed;

        }

        //チャンネル情報を格納
        infoParsed = {
            channelname: dataServer.channels[dat.targetid].name,
            channelid: dat.targetid,
            description: dataServer.channels[dat.targetid].description,
            scope: dataServer.channels[dat.targetid].scope,
            canTalk: dataServer.channels[dat.targetid].canTalk
        }
    }
    catch(e) {
        //読み取れなかったら
        infoParsed = {
            channelname: "存在しないチャンネル",
            channelid: dat.targetid,
            description: "このチャンネルの情報がありません。これが見えていたらおかしいよ。",
            scope: "deleted"
        };
        console.log("dbControl :: getInfoChannel : エラー->", e);
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
                username: objUser[index][1].name,
                role: objUser[index][1].role,
                loggedin : objUser[index][1].state.loggedin,
                banned: objUser[index][1].state.banned
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

    //検索クエリーが空じゃないなら検索開始
    if ( dat.query !== "" ) {
        //検索開始
        for ( index in objUser ) {
            //名前と検索クエリーを小文字にして判別
            if ( (objUser[index][1].name.toLowerCase()).includes(dat.query.toLowerCase()) ) {
                searchResult.push({
                    userid: objUser[index][0],
                    username: objUser[index][1].name,
                });

            }

        }

    //空クエリーなら上20個を返す
    } else {
        for ( let i=0; i<20; i++ ) {
            //もしインデックスの範囲が漏れてるなら
            if ( objUser[i] === undefined ) break;
            
            //検索
            searchResult.push({
                userid: objUser[i][0],
                username: objUser[i][1].name,
            });

        }

    }

    return searchResult;

}

//ユーザーの設定や既読状態などのデータを取得
let getUserSave = function getUserSave(dat) {
    let dataUserSave = {};

    //データ読み取り、なければ作成
    try{
        dataUserSave = JSON.parse(fs.readFileSync('./usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    } catch(e) {
        let dataUserSaveInit = `
            {
                "configAvailable": false,
                "config": {
                },
                "msgReadStateAvailable": false,
                "msgReadState": {
                    
                }
            }
        `;
        fs.writeFileSync("./usersave/"+dat.reqSender.userid+".json", dataUserSaveInit); //JSONファイルを作成
        dataUserSave = JSON.parse(fs.readFileSync('./usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    }

    return dataUserSave;

}

//監査ログの取得
let getModlog = async function getModlog(dat) {
    //JSONファイル一覧を格納する変数
    let ListOfJson = [];

    //JSONファイルの一覧を取得
    try {
        ListOfJson = await new Promise((resolve) => { //取得が完了するまで処理を待つ
            //読み込み
            fs.readdir("./modlog/", (err, files) => {
                ListOfJson = files; //ファイルの名前取得
                resolve(); //処理を終了、次の処理へ

            });

        }).then(() => {
            //追加された順だと古い順なので
            return ListOfJson.reverse();

        });
    } catch(e) { //一覧がとれなかったら失敗と返す
        return -1;
    }
    
    //データを確認した回数
    let dataCheckedCount = 0;
    //取り出したデータの個数(デフォルトで１回に30個まで取り出すようにする)
    let dataSavedCount = 0;

    //送信する監査ログデータ
    let dataModlogResult = {
        endOfData: false, //監査ログの終わりまで入れたってことを示す
        data: [] //監査ログのデータいれるところ
    };

    //JSONファイルごとの監査ログ(一時的変数)
    let dataModlogEachJson = [];

    //それぞれのJSONファイルからデータを取得して配列に追加
    for ( let jsonIndex in ListOfJson) {
        //監査ログJSONを取り出し
        let dataModlog = JSON.parse(fs.readFileSync("./modlog/"+ListOfJson[jsonIndex]));
        //監査ログのデータを配列化
        let objModlog = Object.entries(dataModlog);

        //JSONの長さ
        let jsonLength = Object.keys(dataModlog).length;

        //JSONのデータの長さ文ループして送信するデータ配列へ追加
        for ( let itemIndex=0; itemIndex<jsonLength; itemIndex++ ) {
            //データ個数が10個あるなら切る
            if ( dataSavedCount>=30 ) {
                //処理を終える前に一時的配列の順番を新しい順にするために逆にしてから本配列へ追加
                dataModlogResult.data = dataModlogResult.data.concat(dataModlogEachJson.reverse());
                break;

            }

            //もしデータ取得位置がデータ確認回数と同じならデータの追加をする
            if ( dataCheckedCount >= dat.startLength ) {
                //データ追加
                dataModlogEachJson.push(
                    objModlog[itemIndex][1]
                );

                //データ個数をカウント
                dataSavedCount++;

            }

            //データ確認回数をカウント
            dataCheckedCount++;

        }

        //次のJSON読み込む前に念のため確認
        if ( dataSavedCount>=30 ) break;

        //次ファイルに行く前に配列の順番を新しい順にしてから本配列に追加
        dataModlogResult.data = dataModlogResult.data.concat(dataModlogEachJson.reverse());
        //ファイルごと用の監査ログデータ配列を初期化
        dataModlogEachJson = [];

    }

    //もしデータ個数が最終的に10個未満ならこれでデータ全部ということを設定
    if ( dataSavedCount<30 ) dataModlogResult.endOfData=true;

    return dataModlogResult;

}

//サーバーの設定情報を取得
let getInfoServer = function getInfoServer() {
    //サーバー情報を構成
    let ServerSettings = {
        servername: dataServer.servername,
        registration: dataServer.registration,
        config: dataServer.config,
        serverVersion: ""
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

exports.parseInfos = parseInfos; //IDで情報を取得(ToDo削除)
exports.getInfoUser = getInfoUser; //ユーザー情報を取得
exports.getInfoSessions = getInfoSessions; //ユーザーのセッションデータを返す
exports.getInfoChannel = getInfoChannel; //チャンネル情報を取得
exports.getInfoChannelJoinedUserList = getInfoChannelJoinedUserList; //チャンネルに参加したユーザーのリスト取得
exports.getInfoList = getInfoList; //チャンネルリストの取得
exports.searchUserDynamic = searchUserDynamic; //ユーザーを検索する関数
exports.getUserSave = getUserSave; //ユーザーの個人データ(設定や既読状態)を取得
exports.getModlog = getModlog; //監査ログを取得
exports.getInfoServer = getInfoServer; //サーバーの詳細設定を取得
exports.getInitInfo = getInitInfo; //サーバーの初期情報

exports.dataServer = dataServer; //サーバー情報
exports.dataUser = dataUser; //ユーザー情報