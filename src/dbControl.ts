import * as fs from "fs"; //履歴書き込むため
import * as srcInterface from "./interfaceSrc";

////////////////////////////////////////////////////////////////
//dataServer

//サーバー情報や設定を記録しているJSONファイルを読み取る
const dataServerTemplate:srcInterface.dataServer = {
    "servername": "Girack",
    "registration": {
        "available": true,
        "invite": {
            "inviteOnly": true,
            "inviteCode": ""
        }
    },
    "config": {
        "PROFILE": {
            "PROFILE_ICON_MAXSIZE": "1e6",
            "PROFILE_USERNAME_MAXLENGTH": 32
        },
        "CHANNEL": {
            "CHANNEL_DEFAULT_REGISTERANNOUNCE": "0001",
            "CHANNEL_DEFAULT_JOINONREGISTER": ["0001"],
            "CHANNEL_CREATE_AVAILABLE": true,
            "CHANNEL_DELETE_AVAILABLEFORMEMBER": true,
            "CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER": false
        },
        "MESSAGE": {
            "MESSAGE_PIN_ROLE": "Admin",
            "MESSAGE_TXT_MAXLENGTH": "250",
            "MESSAGE_FILE_MAXSIZE": "5e7"
        }
    },
    "channels": {
        "0001": {
            "name": "random",
            "description": "なんでも雑談",
            "pins": [],
            "scope": "public",
            "canTalk": "Member"
        }
    }
};
//サーバー設定適用用変数
let dataServerLoaded:srcInterface.dataServer = {
    servername: "",
    registration: {
        available: false,
        invite: {
            inviteOnly: false,
            inviteCode: ""
        }
    },
    config: {
        PROFILE: {
            PROFILE_ICON_MAXSIZE: "",
            PROFILE_USERNAME_MAXLENGTH: 0
        },
        CHANNEL: {
            CHANNEL_DEFAULT_REGISTERANNOUNCE: "",
            CHANNEL_DEFAULT_JOINONREGISTER: [],
            CHANNEL_CREATE_AVAILABLE: false,
            CHANNEL_DELETE_AVAILABLEFORMEMBER: false,
            CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER: false
        },
        MESSAGE: {
            MESSAGE_PIN_ROLE: "",
            MESSAGE_TXT_MAXLENGTH: "",
            MESSAGE_FILE_MAXSIZE: ""
        }
    },
    channels: {}
};
try { //読み込んでみる
    //serverデータを読み取り
    dataServerLoaded = JSON.parse(fs.readFileSync('./server.json', 'utf-8')); //サーバー情報のJSON読み込み
    //テンプレに上書きする感じでサーバー情報を取り込む
    dataServerLoaded = mergeDeeply(dataServerTemplate, dataServerLoaded, null);
} catch(e) {
    console.log("dbControl :: dataServerの読み込みエラー->", e);
    //ユーザー登録用のパスワードを生成
    const invCodeLength:number = 24; //生成したい文字列の長さ
    const invCodeSource:string = "abcdefghijklmnopqrstuvwxyz0123456789"; //元になる文字
    let invCodeGenResult:string = "";

    //生成
    for(let i=0; i<invCodeLength; i++){
        invCodeGenResult += invCodeSource[Math.floor(Math.random() * invCodeSource.length)];

    }

    //JSONをコピーする
    dataServerLoaded = dataServerTemplate;
    //招待コードを割り当て
    dataServerLoaded.registration.invite.inviteCode = invCodeGenResult;

}
//サーバー情報変数を適用
export const dataServer = dataServerLoaded;
//この時点で一度書き込み保存
fs.writeFileSync("./server.json", JSON.stringify(dataServer, null, 4));


////////////////////////////////////////////////////////////////
//dataUser周り

//ユーザーを記録しているJSONファイルを読み取る
    //この変数はホルダー
let dataUserLoaded:srcInterface.dataUser = {
    user: {}
};
try { //JSONファイルを読み込んでみる
    dataUserLoaded = JSON.parse(fs.readFileSync('./user.json', 'utf-8')); //ユーザーデータのJSON読み込み
} catch(e) {
    //読み込めないならホルダーだけを作って作れる状態にする
    dataUserLoaded = {user:{}};
    fs.writeFileSync("./user.json", JSON.stringify(dataUserLoaded, null, 4)); //JSONファイルを作成しておく

    //初回ロードになるはずだから招待コードをコンソールへ表示しておく
    console.log("***********************************");
    console.log("***********************************");
    console.log("次の招待コードを使ってユーザーを登録してください。");
    console.log("招待コード : ", dataServer.registration.invite.inviteCode);
    console.log("***********************************");
    console.log("***********************************");

}
//ユーザーデータを適用
export const dataUser = dataUserLoaded;

//起動したときに全員をオフライン状態にする
for ( let index in Object.keys(dataUser.user) ) {
    let userid = Object.keys(dataUser.user)[index]; //ユーザーIDを取得
    dataUser.user[userid].state.loggedin = false; //オフラインと設定

}

console.log("=========================");
console.log("DB認識!");
console.log("=========================");

//チャンネルリストの取得
export let getInfoList = function getInfoList(dat:{
    target: string,
    reqSender: srcInterface.reqSender
}):{ //返すデータの型
    type: string,
    userList: {}, //暫定
    channelList: {} //暫定
} {
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

    //結果格納用
    let infoParsed:{
        type: string,
        userList: {}, //暫定
        channelList: {} //暫定
    } = {
        type: "",
        userList: {},
        channelList: {}
    };

    //チャンネルリストをとる
    if ( dat.target === "channel" ) {
        let channelList:srcInterface.channel = {};
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
            channelList: channelList,
            userList: {}
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
            channelList: {},
            userList: userList
        };
    
    }

    return infoParsed;

}

//ユーザー情報の取得
export let getInfoUser = function getInfoUser(dat:{
    targetid: string,
    reqSender: srcInterface.reqSender
}) {
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

    //ユーザーから収集した情報を入れる
    let infoParsed:srcInterface.userSingle = {
        username: "",
        userid: "",
        channelJoined: [],
        role: "",
        loggedin: false,
        banned: false
    };
    let targetChannelJoined:string[] = []; //チャンネル参加リスト。プライベートは隠す処理をするため予め変数を設定

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
        if ( dataUser.user[dat.targetid] === undefined ) return infoParsed;
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
        };

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
export let getInfoSessions = function getInfoSessions(dat:{reqSender:srcInterface.reqSender}) {
    /*
    dat
    {
        reqSenderだけ
    }
    */

    return dataUser.user[dat.reqSender.userid].state.sessions;

}

//チャンネル情報の取得
export let getInfoChannel = function getInfoChannel(dat:{
    targetid: string,
    reqSender: srcInterface.reqSender
}) {
    //チャンネル情報格納用
    let infoParsed:srcInterface.channelSingle = {
        channelid: "",
        channelname: "",
        description: "",
        pins: [],
        scope: "",
        canTalk: ""
    };

    //権限チェックのためにユーザー情報を取得
    let reqSenderInfo:srcInterface.userSingle = getInfoUser({
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
                description: "このチャンネルの情報がありません。これが見えていたらおかしいよ。",
                pins: [],
                scope: "deleted",
                canTalk: "Member"
            };

            return infoParsed;

        }

        //チャンネル情報を格納
        infoParsed = {
            channelname: dataServer.channels[dat.targetid].name,
            channelid: dat.targetid,
            description: dataServer.channels[dat.targetid].description,
            pins: dataServer.channels[dat.targetid].pins,
            scope: dataServer.channels[dat.targetid].scope,
            canTalk: dataServer.channels[dat.targetid].canTalk
        }
    }
    catch(e) {
        //読み取れなかったら
        infoParsed = {
            channelid: dat.targetid,
            channelname: "存在しないチャンネル",
            description: "このチャンネルの情報がありません。これが見えていたらおかしいよ。",
            pins: [],
            scope: "deleted",
            canTalk: "Member"
        };
        console.log("dbControl :: getInfoChannel : エラー->", e);
    }

    return infoParsed;

}

//チャンネルに参加しているユーザーのリスト取得
export let getInfoChannelJoinedUserList = function getInfoChannelJoinedUserList(dat:{
    targetid: string,
    reqSender: srcInterface.reqSender
}) {
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
    let channelJoinedUserList:srcInterface.userSingle[] = []; //送信予定の配列
    let objUser = Object.entries(dataUser.user); //JSONをオブジェクト化

    try {
        //情報収集
        for ( let index in objUser ) {
            //ユーザー情報の中で指定のチャンネルに参加しているなら配列追加
            if ( objUser[index][1].channel.includes(dat.targetid) ) {
                //配列追加
                channelJoinedUserList.push({
                    userid: objUser[index][0],
                    username: objUser[index][1].name,
                    role: objUser[index][1].role,
                    loggedin : objUser[index][1].state.loggedin,
                    banned: objUser[index][1].state.banned,
                    channelJoined: objUser[index][1].channel
                });

            }

        }
    } catch(e) {
        console.log("dbControl :: getInfoChannelJoinedUserList : エラー", e);
    }

    return channelJoinedUserList;

}

//ユーザーを検索する関数
export let searchUserDynamic = function searchUserDynamic(dat:{
    query: string,
    reqSender: srcInterface.reqSender
}) {
    /*
    dat
    {
        query: this.userSearchQuery,
        reqSender: {
            ...
        }
    }
    */

    //検索結果を入れる配列
    let searchResult:{
        userid: string,
        username: string
    }[] = [];
    //ユーザー名を配列化
    let objUser = Object.entries(dataUser.user);

    //検索クエリーが空じゃないなら検索開始
    if ( dat.query !== "" ) {
        //検索開始
        for ( let index in objUser ) {
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
export let getUserSave = function getUserSave(dat:{
    reqSender: srcInterface.reqSender
}) {
    //ユーザーの個人データ格納用
    let dataUserSave:srcInterface.dataUserSave = {
        configAvailable: false,
        config: undefined,
        msgReadStateAvailable: false,
        msgReadState: undefined,
        channelOrder: []
    };

    //データ読み取り、なければ作成
    try{
        dataUserSave = JSON.parse(fs.readFileSync('./userFiles/usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    } catch(e) {
        let dataUserSaveInit = `
            {
                "configAvailable": false,
                "config": {
                },
                "msgReadStateAvailable": false,
                "msgReadState": {
                },
                "channelOrder": []
            }
        `;
        fs.writeFileSync("./userFiles/usersave/"+dat.reqSender.userid+".json", dataUserSaveInit); //JSONファイルを作成
        dataUserSave = JSON.parse(fs.readFileSync('./userFiles/usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    }

    return dataUserSave;

}

//監査ログの取得
export let getModlog = async function getModlog(dat:{
    startLength: number,
    reqSender: srcInterface.reqSender
}) {
    //JSONファイル一覧を格納する変数
    let ListOfJson:string[] = [];

    //JSONファイルの一覧を取得
    try {
        ListOfJson = await new Promise<void>((resolve) => { //取得が完了するまで処理を待つ
            //読み込み
            fs.readdir("./serverFiles/modlog/", (err, files) => {
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
    let dataCheckedCount:number = 0;
    //取り出したデータの個数(デフォルトで１回に30個まで取り出すようにする)
    let dataSavedCount:number = 0;

    //送信する監査ログデータ
    let dataModlogResult:{
        endOfData: boolean,
        data: any[] //暫定
    } = {
        endOfData: false, //監査ログの終わりまで入れたってことを示す
        data: [] //監査ログのデータいれるところ
    };

    //JSONファイルごとの監査ログ(一時的変数)
    let dataModlogEachJson = [];

    //それぞれのJSONファイルからデータを取得して配列に追加
    for ( let jsonIndex in ListOfJson) {
        //監査ログJSONを取り出し
        let dataModlog = JSON.parse(fs.readFileSync("./serverFiles/modlog/"+ListOfJson[jsonIndex], "utf-8"));
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
export let getInfoServer = function getInfoServer() {
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
export let getInitInfo = function getInitInfo() {
    return {
        servername: dataServer.servername, //サーバー名
        registerAvailable: dataServer.registration.available, //登録可能かどうか
        inviteOnly: dataServer.registration.invite.inviteOnly,
        serverVersion: "..." //招待制かどうか
    };
}

//JSONをマージするだけの関数 (https://qiita.com/riversun/items/60307d58f9b2f461082a)
function mergeDeeply(target:any, source:any, opts:any) {
    const isObject = (obj:any) => obj && typeof obj === 'object' && !Array.isArray(obj);
    const isConcatArray:boolean = opts && opts.concatArray;
    let result = Object.assign({}, target);
    //ここからメイン（型を調べてから）
    if (isObject(target) && isObject(source)) {
        //一つ一つを調べて追加していく感じ
        for (const [sourceKey, sourceValue] of Object.entries(source)) {
            const targetValue = target[sourceKey];
            if (isConcatArray && Array.isArray(sourceValue) && Array.isArray(targetValue)) {
                result[sourceKey] = targetValue.concat(...sourceValue);
            }
            else if (isObject(sourceValue) && target.hasOwnProperty(sourceKey)) {
                result[sourceKey] = mergeDeeply(targetValue, sourceValue, opts);
            }
            else {
                Object.assign(result, {[sourceKey]: sourceValue});
            }
        }
    }
    return result;
}

// exports.getInfoUser = getInfoUser; //ユーザー情報を取得
// exports.getInfoSessions = getInfoSessions; //ユーザーのセッションデータを返す
// exports.getInfoChannel = getInfoChannel; //チャンネル情報を取得
// exports.getInfoChannelJoinedUserList = getInfoChannelJoinedUserList; //チャンネルに参加したユーザーのリスト取得
// exports.getInfoList = getInfoList; //チャンネルリストの取得
// exports.searchUserDynamic = searchUserDynamic; //ユーザーを検索する関数
// exports.getUserSave = getUserSave; //ユーザーの個人データ(設定や既読状態)を取得
// exports.getModlog = getModlog; //監査ログを取得
// exports.getInfoServer = getInfoServer; //サーバーの詳細設定を取得
// exports.getInitInfo = getInitInfo; //サーバーの初期情報

// exports.dataServer = dataServer; //サーバー情報
// exports.dataUser = dataUser; //ユーザー情報