let db = require("./dbControl.js");

const fs = require('fs'); //履歴書き込むため

//ユーザーの情報更新とか
let config = function config(dat) {
    let answer;
    console.log("config :: データ更新↓");
    console.log(dat);

    //変更したいデータの型合わせて更新、そしてそのデータを転送
    switch( dat.target ) {
        //ユーザーの情報を変更する
        case "user":
            if ( dat.name !== undefined ) {
                db.dataUser.user[dat.targetid].name = dat.name; //DB更新

            }
            
            answer = db.parseInfos({target:"user", targetid:dat.targetid}); //更新したデータを収集
            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4)); //DBをリモート保存

            return answer;

        //チャンネル情報とか設定を変える
        case "channel":
            //変更対象が名前なら
            if ( dat.name !== undefined ) {
                db.dataServer[dat.targetid].channelname = dat.channelname;

            }

            //変更対象が概要なら
            if ( dat.description !== undefined ) {
                db.dataServer[dat.targetid].description = dat.description;

            }

            //新しいチャンネルの情報取得
            answer = db.getInfoChannel({
                targetid: dat.targetid
            });

            fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4)); //DBをJSONへ保存
            
            return answer;

        //サーバーの情報とか設定を変える
        case "server":
            console.log("Server...");
            break;

        default:
            return -1;

    }

}

//ユーザーの管理(ロール変更とBANとか)
let mod = function mod(dat) {
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
    let sendersInfo = db.getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    //権限チェック
    if ( sendersInfo.role === "Member" ) { return; }

    //actionに応じてそれぞれの処理を行う
    switch( dat.action.change ) {
        //ユーザーのロール変更
        case "role":
            //ロール更新
            db.dataUser.user[dat.targetid].role = dat.action.value;
            break;

        //ユーザーのBAN
        case "ban":
            console.log("infoUpdate :: mod : BANしました -> " + dat.targetid);
            db.dataUser.user[dat.targetid].state.banned = dat.action.value;
            break;

        //ユーザーの削除
        case "delete":
            console.log("infoUpdate :: mod : 削除します -> " + dat.targetid);
            if ( sendersInfo.role !== "Admin" ) break; //Adminじゃないならここでやめる
            if ( dat.reqSender.userid === dat.targetid ) break; //送信者自身を消そうとしているならやめる

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
let changeServerSettings = function changeServerSettings(dat) {
    /*
    dat
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

    //設定更新
    db.dataServer.registration = dat.registration;

    fs.writeFileSync("./server.json", JSON.stringify(db.dataServer, null, 4));

}

//チャンネル設定の更新
let changeChannelSettings = function changeChannelSettings(dat) {
    //名前と概要と公開範囲を更新
    db.dataServer.channels[dat.targetid].name = dat.channelname;
    db.dataServer.channels[dat.targetid].description = dat.description;
    db.dataServer.channels[dat.targetid].scope = dat.scope;

    //JSONへ書き込み
    fs.writeFileSync("./server.json", JSON.stringify(db.dataServer, null, 4));

}

//プロフィール変更
let changeProfile = function changeProfile(dat) {
    db.dataUser.user[dat.reqSender.userid].name = dat.name; //DB更新
    
    //DBをJSONへ保存
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));
    
    //更新したデータを収集
    //let answer = db.parseInfos({target:"user", targetid:dat.targetid});
    let answer = db.getInfoUser({
        targetid: dat.reqSender.userid,
        reqSender: dat.reqSender
    });

    return answer;

}

//プロフィール変更
let changeProfileIcon = function changeProfileIcon(dat) {
    //db.dataUser.user[dat.reqSender.userid].name = dat.name; //DB更新
    
    //DBをJSONへ保存
    //fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));
    
    //更新したデータを収集

    return answer;

}

//ユーザーの設定や既読状態などのデータを上書き保存する
let updateUserSaveConfig = function updateUserSaveConfig(dat) {
    let dataUserSave = {};

    //データ読み取り、なければ作成
    try{
        dataUserSave = JSON.parse(fs.readFileSync('./usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    } catch(e) {
        let dataUserSaveInit = `
            {
                configAvailable: false,
                config: {
                },
                msgReadStateAvailable: false,
                msgReadState: {
                    
                }
            }
        `;
        fs.writeFileSync("./usersave/"+dat.reqSender.userid+".json", dataUserSaveInit); //JSONファイルを作成
        dataUserSave = JSON.parse(fs.readFileSync('./usersave/'+dat.reqSender.userid+'.json', 'utf-8')); //ユーザーデータのJSON読み込み
    }

    dataUserSave.config = dat.config;

}

//チャンネルの参加・退出処理
let channelAction = function channelAction(dat) {
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
        //配列へチャンネルIDをプッシュ
        //db.dataUser.user[dat.userid].channel.push(dat.channelid);
        
        //送信者の情報取得
        let senderInfo = db.getInfoUser({
            targetid: dat.reqSender.userid
        });

        //参加する人の情報取得
        let joiningUserInfo = db.getInfoUser({
            targetid: dat.userid
        });

        //チャンネルがプライベートで参加者がAdminでなく、招待者がそのチャンネルに参加していなら拒否
        if (
            db.dataServer.channels[dat.channelid].scope === "private" &&
            joiningUserInfo.role !== "Admin" &&
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
                targetid: dat.reqSender.userid
            });

            //ロールチェック
            if ( senderInfo.role === "Member" ) {
                console.log("infoUpdate :: channelAction : 権限違うやん");
                return -1;

            }

            console.log("infoUpdate :: channelAction : 誰かが蹴られるぜ");

        }

        //配列からチャンネルIDを削除
        db.dataUser.user[dat.userid].channel.splice(db.dataUser.user[dat.userid].channel.indexOf(dat.channelid), 1);

    }

    //JSONファイルへ書き込み
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4)); //DBをリモート保存

    //更新したデータを収集
    let answer = db.getInfoUser({
        targetid: dat.userid,
        reqSender: dat.reqSender
    });

    return answer;

}

//チャンネル作成
let channelCreate = function channelCreate(dat) {
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

    let newChannelId = "";
    return new Promise((resolve) => {
        //IDを探すまでループ
        setTimeout(() => {
            console.log("infoUpdate :: channelCreate : チャンネルIDを選んでいます...");
            newChannelId = parseInt(Math.random()*9999).toString().padStart(4,0);
            //作ったチャンネルIDが空いていたらループを消す
            if ( db.dataServer.channels[newChannelId] === undefined ) { //チャンネル情報がないことを確認
                resolve();
    
            }

        }, 100);

    }).then(() => {
        //チャンネル作成
        db.dataServer.channels[newChannelId] = {
            name: dat.channelname,
            description: dat.description,
            scope: dat.scope
        };

        //チャンネル作成者をそのまま参加させる
        db.dataUser.user[dat.reqSender.userid].channel.push(newChannelId);

        console.log("infoUpdate :: channelCreate : 作った");
    
        //ユーザー情報をファイルへ書き込み
        fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));

        //サーバー情報をファイルへ書き込み
        fs.writeFileSync("./server.json", JSON.stringify(db.dataServer, null, 4));
        
        return true;

    });
    
}

//チャンネル作成
let channelRemove = function channelRemove(dat) {
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

    //チャンネル削除
    delete db.dataServer.channels[dat.channelid];

    //消去されたチャンネルにいたユーザーリスト
    let userChanged = [];

    //ユーザー全員から消したチャンネルをユーザーの"参加チャンネル"リストから消去
    for ( index in Object.entries(db.dataUser.user) ) {
        //一時的にユーザーIDを抽出
        let userid = Object.entries(db.dataUser.user)[index][0];
        //ユーザーの参加チャンネルリストを加工
        db.dataUser.user[userid].channel = Object.entries(db.dataUser.user)[index][1].channel.filter(cid => cid!==dat.channelid);
        //消去されたチャンネルにいたユーザーリストに追加
        userChanged.push(userid);

    }

    //サーバー情報をファイルへ書き込み
    fs.writeFileSync("./user.json", JSON.stringify(db.dataUser, null, 4));
    fs.writeFileSync("./server.json", JSON.stringify(db.dataServer, null, 4));

    //参加していた人リストにそれぞれクライアントで更新させる
    return userChanged;

}

exports.config = config;
exports.mod = mod; //管理者からのユーザー管理
exports.changeServerSettings = changeServerSettings; //サーバーの設定変更
exports.changeChannelSettings = changeChannelSettings; //チャンネルの設定変更
exports.changeProfile = changeProfile; //プロフィールの変更
exports.updateUserSaveConfig = updateUserSaveConfig; //ユーザーの個人データで設定データを上書き保存
//exports.updateUserSaveMsgReadState = updateUserSaveMsgReadState; //ユーザーの個人データで既読状態を上書き保存
exports.channelAction = channelAction; //チャンネルの参加・退出
exports.channelCreate = channelCreate; //チャンネル作成
exports.channelRemove = channelRemove; //チャンネル削除