//let db = require("./dbControl.js");
import { dataServer, dataUser, getInfoUser } from "./dbControl";
import * as srcInterface from "./interfaceSrc";

import * as fs from "fs"; //履歴書き込むため

//ユーザーの管理(ロール変更とBANとか)
let mod = function mod(dat:{
    targetid: string,
    action: {
        change: string,
        value: any
    },
    reqSender: srcInterface.reqSender
}) {
    /*
    dat
    {
        targetid: this.userid,
        action: {
            change: ("role"|"ban"|"delete"),
            value: "Moderator" あるいは true とか
        },
        reqSender: {...}
    }
    */

    //権限確認のために
    let sendersInfo = getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    //権限チェック
    if ( sendersInfo.role === "Member" ) { return; }

    //actionに応じてそれぞれの処理を行う
    switch( dat.action.change ) {
        //ユーザーのロール変更
        case "role":
            //監査ログ用
            let roleBefore = db.dataUser.user[dat.targetid].role;
            //ロール更新
            db.dataUser.user[dat.targetid].role = dat.action.value;
            
            //監査ログへの記録処理
            recordModeration(
                dat.reqSender.userid,
                {
                    type: "user",
                    userid: dat.targetid,
                    channelid: "",
                    messageid: ""
                },
                {
                    actionname: "userChangeRole",
                    valueBefore: roleBefore,
                    valueAfter: dat.action.value
                }
            );
            
            break;

        //ユーザーのBAN
        case "ban":
            console.log("infoUpdate :: mod : BAN状態を更新 -> " + dat.targetid);
            //BAN状態を更新
            db.dataUser.user[dat.targetid].state.banned = dat.action.value;
            //BAN状態に応じて監査ログへの記録
            if ( dat.action.value ) {
                //監査ログへの記録処理
                recordModeration(
                    dat.reqSender.userid,
                    {
                        type: "user",
                        userid: dat.targetid,
                        channelid: "",
                        messageid: ""
                    },
                    {
                        actionname: "userBan",
                        valueBefore: "false",
                        valueAfter: "true"
                    }
                );

            } else {
                //監査ログへの記録処理
                recordModeration(
                    dat.reqSender.userid,
                    {
                        type: "user",
                        userid: dat.targetid,
                        channelid: "",
                        messageid: ""
                    },
                    {
                        actionname: "userPardon",
                        valueBefore: "true",
                        valueAfter: "false"
                    }
                );

            }
            
            break;

        //ユーザーの削除
        case "delete":
            console.log("infoUpdate :: mod : 削除します -> " + dat.targetid);
            if ( sendersInfo.role !== "Admin" ) break; //Adminじゃないならここでやめる
            if ( dat.reqSender.userid === dat.targetid ) break; //送信者自身を消そうとしているならやめる

            //監査ログへの記録処理
            recordModeration(
                dat.reqSender.userid,
                {
                    type: "user",
                    userid: dat.targetid,
                    channelid: "",
                    messageid: ""
                },
                {
                    actionname: "userDelete",
                    valueBefore: dat.targetid,
                    valueAfter: ""
                }
            );

            delete db.dataUser.user[dat.targetid]; //削除
            break;

        default:
            console.log("infoUpdate :: mod : エラー...?")
            break;

    }

    //JSONへ書き込み
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

}

//サーバーの設定を更新
let changeServerSettings = function changeServerSettings(dat:{
    servername: string,
    config: {
        PROFILE: {
            PROFILE_ICON_MAXSIZE: string,
            PROFILE_USERNAME_MAXLENGTH: number
        },
        CHANNEL: {
            CHANNEL_DEFAULT_REGISTERANNOUNCE: string,
            CHANNEL_DEFAULT_JOINONREGISTER: string[],
            CHANNEL_CREATE_AVAILABLE: boolean,
            CHANNEL_DELETE_AVAILABLEFORMEMBER: boolean,
            CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER: boolean
        },
        MESSAGE: {
            MESSAGE_PIN_ROLE: string,
            MESSAGE_TXT_MAXLENGTH: string,
            MESSAGE_FILE_MAXSIZE: string
        }
    },
    registration: {
        available: boolean,
        invite: {
            inviteOnly: boolean,
            inviteCode: string
        }
    }
    reqSender: srcInterface.reqSender
}) {
    /*
    servername: "xxx",
    config: this.displaySettings.config,
    registration: {
        available: this.displaySettings.registerAvailable,
        invite: {
            inviteOnly: this.displaySettings.inviteOnly,
            inviteCode: this.displaySettings.inviteCode
        }
    },
    reqSender: {
        userid: Userinfo.userid,
        sessionid: Userinfo.sessionid
    }
    */

    //権限を確認するために送信者の情報を取得
    let sendersInfo = db.getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    //権限チェック
    if ( sendersInfo.role !== "Admin" ) { return; }

    //インスタンスのアカウント登録設定を更新
    dataServer.registration = dat.registration;
    //インスタンス名の更新
    dataServer.servername = dat.servername;

    //インスタンス設定をマージ
    dataServer.config = {...dataServer.config, ...dat.config};

    //監査ログへの記録処理
    recordModeration(
        dat.reqSender.userid,
        {
            type: "server",
            userid: "",
            channelid: "",
            messageid: ""
        },
        {
            actionname: "serverEditConfig",
            valueBefore: "",
            valueAfter: ""
        }
    );

    //書き込み
    fs.writeFileSync("./server.json", JSON.stringify(dataServer, null, 4));

}

//チャンネル設定の更新
let changeChannelSettings = function changeChannelSettings(dat:{
    targetid: string,
    channelname: string,
    description: string,
    scope: string,
    canTalk: string,
    reqSender: srcInterface.reqSender
}) {
    //名前を変更するなら監査記録
    if ( dataServer.channels[dat.targetid].name !== dat.channelname ) {
        //監査ログへの記録処理
        recordModeration(
            dat.reqSender.userid,
            {
                type: "channel",
                userid: "",
                channelid: dat.targetid,
                messageid: ""
            },
            {
                actionname: "channelEditName",
                valueBefore: dataServer.channels[dat.targetid].name,
                valueAfter: dat.channelname
            }
        );

    }

    //概要を変更するなら監査記録
    if ( dataServer.channels[dat.targetid].description !== dat.description ) {
        //監査ログへの記録処理
        recordModeration(
            dat.reqSender.userid,
            {
                type: "channel",
                userid: "",
                channelid: dat.targetid,
                messageid: ""
            },
            {
                actionname: "channelEditDesc",
                valueBefore: dataServer.channels[dat.targetid].description,
                valueAfter: dat.description
            }
        );

    }

    //公開範囲を変更するなら監査記録
    if ( dataServer.channels[dat.targetid].scope !== dat.scope ) {
        //監査ログへの記録処理
        recordModeration(
            dat.reqSender.userid,
            {
                type: "channel",
                userid: "",
                channelid: dat.targetid,
                messageid: ""
            },
            {
                actionname: "channelEditScope",
                valueBefore: dataServer.channels[dat.targetid].scope,
                valueAfter: dat.scope
            }
        );

    }

    //名前と概要と公開範囲を更新
    dataServer.channels[dat.targetid].name = dat.channelname;
    dataServer.channels[dat.targetid].description = dat.description;
    dataServer.channels[dat.targetid].canTalk = dat.canTalk;

    //公開範囲をMemberでも変えられる設定、あるいはMemberじゃないならだったら適用
    if ( 
        db.dataUser.user[dat.reqSender.userid].role !== "Member" ||
        dataServer.config.CHANNEL.CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER
    ) {
        dataServer.channels[dat.targetid].scope = dat.scope;

    }

    //JSONへ書き込み
    fs.writeFileSync("./server.json", JSON.stringify(dataServer, null, 4));

}

//プロフィール変更
let changeProfile = function changeProfile(dat:{
    targetid: string,
    name: string,
    reqSender: srcInterface.reqSender
}) {
    //変えるユーザーと送信者が違うなら権限チェック
    if ( dat.reqSender.userid !== dat.targetid ) {
        //Adminじゃないならキャンセル
        if ( db.dataUser.user[dat.reqSender.userid].role !== "Admin" ) {
            return -1;

        }

        //監査ログへの記録処理
        recordModeration(
            dat.reqSender.userid,
            {
                type: "user",
                userid: dat.targetid,
                channelid: null,
                messageid: null
            },
            {
                actionname: "userChangeName",
                valueBefore: db.dataUser.user[dat.targetid].name,
                valueAfter: dat.name
            }
        );

    }

    //ユーザー名被ってるフラグ
    let usernameAlreadyUsedFlag = false;
    //ユーザーデータを配列化
    let objUser:any = Object.entries(db.dataUser.user);
    for ( let index in objUser ) {
        if ( objUser[index][1].name === dat.name ) {
            //ユーザー名がすでに使われていると設定
            usernameAlreadyUsedFlag = true;
            break;

        }

    }

    //もしユーザー名があいているなら
    if ( !usernameAlreadyUsedFlag ) {
        db.dataUser.user[dat.targetid].name = dat.name; //DB更新
    
        //DBをJSONへ保存
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

    }
    
    //更新したデータを収集
    //let answer = db.parseInfos({target:"user", targetid:dat.targetid});
    let answer = db.getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    return answer;

}

//ユーザーの設定のデータを上書き保存する
let updateUserSaveConfig = function updateUserSaveConfig(dat:{
    config: any,
    reqSender: srcInterface.reqSender
}) {
    //ユーザー個人データ格納用変数
    let dataUserSave:srcInterface.dataUserSave = {
        configAvailable: false,
        config: {},
        msgReadStateAvailable: false,
        msgReadState: {},
        channelOrder: []
    };

    //データ読み取り、なければ作成
    try{
        dataUserSave = JSON.parse(fs.readFileSync('./userFiles/usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    } catch(e) {
        let dataUserSaveInit:string = `
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

    //上書き、JSONファイル保存
    dataUserSave.config = dat.config;
    dataUserSave.configAvailable = true;
    fs.writeFileSync("./userFiles/usersave/"+dat.reqSender.userid+".json", JSON.stringify(dataUserSave, null, 4));

}

//ユーザーの既読状態のデータを上書き保存する
let updateUserSaveMsgReadState = function updateUserSaveMsgReadState(dat:{
    msgReadState: any,
    reqSender: srcInterface.reqSender
}) {
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

    dataUserSave.msgReadState = dat.msgReadState;
    dataUserSave.msgReadStateAvailable = true;
    fs.writeFileSync("./userFiles/usersave/"+dat.reqSender.userid+".json", JSON.stringify(dataUserSave, null, 4)); //JSONファイル保存

}

//ユーザーが設定しているチャンネルの順番を上書き保存
let updateUserSaveChannelOrder = function updateUserSaveChannelOrder(dat:{
    channelOrder: string[],
    reqSender: srcInterface.reqSender
}) {
    //ユーザーデータの取り込み先
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

    dataUserSave.channelOrder = dat.channelOrder;
    fs.writeFileSync("./userFiles/usersave/"+dat.reqSender.userid+".json", JSON.stringify(dataUserSave, null, 4)); //JSONファイル保存

}

//チャンネルの参加・退出処理
let channelAction = function channelAction(dat:{
    action: string,
    channelid: string,
    userid: string,
    reqSender: srcInterface.reqSender
}) {
    /*
    dat
    {
        action: ("join" | "leave"),
        channelid: channelid,
        userid: Userinfo.userid,
        reqSender: {
            userid: userinfo.userid,
            sessionid: userinfo.sessionid
        }
    }
    */

    if ( dat.action === "join" ) {        
        //送信者の情報取得
        let senderInfo = db.getInfoUser({
            targetid: dat.reqSender.userid,
            reqSender: dat.reqSender
        });

        //チャンネルがプライベートで参加者が権力者でなく、また招待者がそのチャンネルに参加していなら拒否
        if (
            dataServer.channels[dat.channelid].scope === "private" &&
            db.dataUser.user[dat.userid].role !== "Admin" &&
            !senderInfo.channelJoined.includes(dat.channelid)
        ) {
            return -1;

        }

        //配列へチャンネルIDをプッシュ
        db.dataUser.user[dat.userid].channel.push(dat.channelid);

    }

    if ( dat.action === "leave" ) {
        //もし送信者と抜ける人が違っていたら権限確認
        if ( dat.userid !== dat.reqSender.userid ) {
            //送信者の情報取得
            let senderInfo = db.getInfoUser({
                targetid: dat.reqSender.userid,
                reqSender: dat.reqSender
            });

            //ロールチェック
            if ( senderInfo.role === "Member" ) {
                console.log("infoUpdate :: channelAction : 権限違うやん");
                return -1;

            }

            console.log("infoUpdate :: channelAction : 誰かが蹴られるぜ");

            //監査ログへの記録処理
            recordModeration(
                dat.reqSender.userid,
                {
                    type: "user",
                    userid: dat.userid,
                    channelid: dat.channelid,
                    messageid: ""
                },
                {
                    actionname: "userKickFromChannel",
                    valueBefore: "",
                    valueAfter: ""
                }
            );

        }

        //配列からチャンネルIDを削除
        db.dataUser.user[dat.userid].channel.splice(db.dataUser.user[dat.userid].channel.indexOf(dat.channelid), 1);

    }

    //JSONファイルへ書き込み
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4)); //DBをリモート保存

    //更新したデータを収集
    let answer:srcInterface.dataUser = db.getInfoUser({
        targetid: dat.userid,
        reqSender: dat.reqSender
    });

    return answer;

}

//チャンネル作成
let channelCreate = async function channelCreate(dat:{
    channelname: string,
    scope: string,
    description: string,
    reqSender: srcInterface.reqSender
}) {
    /*
    dat
    {
        channelname: dat.channelname,
        reqSender: {
            userid: "このリクエストを送っているユーザーのID",
            sessionid: "セッションID"
        },
    }
    */

    //チャンネル名が32文字以上ならスルー
    if ( dat.channelname.length > 32 ) return -1;

    let newChannelId:string = "";
    return new Promise<void>((resolve) => {
        //IDを探すまでループ
        setTimeout(() => {
            console.log("infoUpdate :: channelCreate : チャンネルIDを選んでいます...");
            //チャンネルID生成
            newChannelId = Math.floor(Math.random()*9999).toString().padStart(4,"0");
            //作ったチャンネルIDが空いていたらループを消す
            if ( dataServer.channels[newChannelId] === undefined ) { //チャンネル情報がないことを確認
                resolve();
    
            }

        }, 100);

    }).then(() => {
        try {
            //チャンネル作成
            dataServer.channels[newChannelId] = {
                name: (dat.channelname).toString(),
                description: (dat.description).toString(),
                pins: [],
                scope: dat.scope,
                canTalk: "Member"
            };
        } catch(e) {
            console.log("infoUpdate :: channelCreate : e->", e);
            return -1;
        }

        //チャンネル作成者をそのまま参加させる
        db.dataUser.user[dat.reqSender.userid].channel.push(newChannelId);
    
        //監査ログへの記録処理
        recordModeration(
            dat.reqSender.userid,
            {
                type: "channel",
                userid: "",
                channelid: newChannelId,
                messageid: ""
            },
            {
                actionname: "channelCreate",
                valueBefore: "",
                valueAfter: dat.channelname
            }
        );

        //ユーザー情報をファイルへ書き込み
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

        //サーバー情報をファイルへ書き込み
        fs.writeFileSync("./server.json", JSON.stringify(dataServer, null, 4));
        
        return {result:true, channelid:newChannelId};

    });
    
}

//チャンネル削除
let channelRemove = function channelRemove(dat:{
    channelid: string,
    reqSender: srcInterface.reqSender
}) {
    /*
    dat
    {
        channelid: dat.channelid,
        reqSender: {
            userid: "このリクエストを送っているユーザーのID",
            sessionid: "セッションID"
        },
    }
    */

    //そもそも指定のチャンネルIDがないなら処理停止
    if ( dataServer.channels[dat.channelid] === undefined ) return -1;

    //チャンネル削除
    delete dataServer.channels[dat.channelid];

    //消去されたチャンネルにいたユーザーリスト
    let userChangedEffected = [];

    //ユーザー全員から消したチャンネルをユーザーの"参加チャンネル"リストから消去
    for ( let index in Object.entries(db.dataUser.user) ) {
        //一時的にユーザーIDを抽出
        let userid = Object.entries(db.dataUser.user)[index][0];
        //ユーザーの参加チャンネルリストを加工
        db.dataUser.user[userid].channel = Object.entries(dataUser.user)[index][1].channel.filter((cid:string) => cid!==dat.channelid);
        //消去されたチャンネルにいたユーザーリストに追加
        userChangedEffected.push(userid);

    }

    //もし登録通知用チャンネルに設定されていたら書き換え
    if ( dataServer.config.CHANNEL.CHANNEL_DEFAULT_REGISTERANNOUNCE === dat.channelid ) {
        //チャンネルIDの最初をとりあえず取り出す
        let channelIdFallback = Object.keys(dataServer.channels)[0];
        //設定
        dataServer.config.CHANNEL.CHANNEL_DEFAULT_REGISTERANNOUNCE = channelIdFallback;

    }
    //登録時の自動参加チャンネルに設定されていたら
    if ( dataServer.config.CHANNEL.CHANNEL_DEFAULT_JOINONREGISTER.indexOf(dat.channelid) !== -1 ) {
        //そのチャンネルIDのインデックス番号を取得
        let index = dataServer.config.CHANNEL.CHANNEL_DEFAULT_JOINONREGISTER.indexOf(dat.channelid);
        //そのチャンネルIDを削除
        dataServer.config.CHANNEL.CHANNEL_DEFAULT_JOINONREGISTER.splice(index, 1);

    }

    
    //監査ログへの記録処理
    recordModeration(
        dat.reqSender.userid,
        {
            type: "channel",
            userid: "",
            channelid: dat.channelid,
            messageid: ""
        },
        {
            actionname: "channelDelete",
            valueBefore: "",
            valueAfter: ""
        }
    );

    //サーバー情報をファイルへ書き込み
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));
    fs.writeFileSync("./server.json", JSON.stringify(dataServer, null, 4));

    //参加していた人リストにそれぞれクライアントで更新させる
    return userChangedEffected;

}

//監査ログへの書き込み
let recordModeration = function recordModeration(
    actionBy:string,
    actionTo:{
        type: string,
        userid: string,
        channelid: string | null,
        messageid: string | null
    },
    actionInfo:{
        actionname: string,
        valueBefore: string,
        valueAfter: string
    }
) {
    /*
    actionBy => 変更を起こしたユーザーID
        例 : xxxxxx
    actionTo => 変更を受けたチャンネルあるいはユーザーID
        例 : {
            type: (user|channel|message|config),
            userid: xxxxxxx, //変更に関係があるユーザーID
            channelid: 0000000, //変更に関係があるチャンネルID
            messageid: xxxxxxxx //メッセージの場合メッセージID(それ以外だと基本空)
        }
    actionInfo => 変更内容
        例 : {
            actionname: "変更対象のパラメータ(下の一覧を参照)",
            valueBefore: "asdf", //変更前
            valueAfter: "fdsa" //変更後
        }
        
    }

    actionnameの一覧 => 
        userに対して
            userBan,
            userPardon,
            userDelete,
            userChangeRole,
            userChangeName,
            userKickFromChannel
        
        channelに対して
            channelEditName,
            channelEditDesc,
            channelEditScope,
            channelCreate,
            channelDelete
        
        messageに対して
            messageDelete //メッセージ削除の場合プライバシーを考慮して変更前と変更後の値は空にする
        
        serverに対して //serverの場合targetidは空に
            serverEditName,
            serverEditConfig
    */

    //日付別にJSONファイルを書き込むため
    let t = new Date();  // 正しいコード
    //日付
    let tY = t.getFullYear();
    let tM = (t.getMonth()+1).toString().padStart(2,"0");
    let tD = t.getDate().toString().padStart(2,"0");
    let tTime = t.getHours().toString().padStart(2,"0") + t.getMinutes().toString().padStart(2,"0") + t.getSeconds().toString().padStart(2,"0");
    let tDateForName = tY + "_" +  tM + "_" + tD;

    //変更ID(actionId)用
    let fullDate = tY+tM+tD+tTime;
    
    //JSONのファイル名
    let nameOfJson = "modlog_" + tDateForName;
    //監査ログを書きこむJSONファイルのディレクトリ
    let pathOfJson = "./serverFiles/modlog/" + nameOfJson + ".json";

    //JSONファイルを開いてみて、いけたらそのまま読み込んで処理、なかったら作る
    try { //JSONの存在確認
        //ファイルを読み込んでみる(使いはしない、存在を確認するだけ)
        fs.statSync(pathOfJson);
    } catch(err) { //存在無しなら(読み込みエラーなら)
        //空のJSONを作成
        fs.writeFileSync(pathOfJson, "{}"); //DBをJSONで保存
    }

    //監査ログを読み込み
    let dataModlog = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8'));

    //変更の記録処理
    try {
        //この変更そのものを判別するためのID
        let actionId = [fullDate,Object.keys(dataModlog).length+1].join("");
        //JSONへデータ追加
        dataModlog[ actionId ] = {
            actionId: actionId,
            actionBy: actionBy,
            actionTo: actionTo,
            actionInfo: actionInfo
        };
    } catch(e) {
        return -1;
    }

    //JSONファイルを保存
    fs.writeFileSync(pathOfJson, JSON.stringify(dataModlog, null, 4));

}

exports.mod = mod; //管理者からのユーザー管理
exports.changeServerSettings = changeServerSettings; //サーバーの設定変更
exports.changeChannelSettings = changeChannelSettings; //チャンネルの設定変更
exports.changeProfile = changeProfile; //プロフィールの変更
exports.updateUserSaveConfig = updateUserSaveConfig; //ユーザーの個人データで設定データを上書き保存
exports.updateUserSaveMsgReadState = updateUserSaveMsgReadState; //ユーザーの個人データで既読状態を上書き保存
exports.updateUserSaveChannelOrder = updateUserSaveChannelOrder; //ユーザーの個人データでチャンネルの順番を上書き保存
exports.channelAction = channelAction; //チャンネルの参加・退出
exports.channelCreate = channelCreate; //チャンネル作成
exports.channelRemove = channelRemove; //チャンネル削除
exports.recordModeration = recordModeration; //監査ログを書き込む関数