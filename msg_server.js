//msg_server.js
//メッセージ関連

const db = require("./db.cjs"); //データベース関連

/*
=db.cjsから=
userinfoRemote
{
    username: dataUser.user[id].name,
    userid: id,
    sessionid: dataUser.user[id].state.session_id
}

m
{
    userid: userid, //ユーザーID
    channelid: channelid, //チャンネルのID
    content: txt, //メッセージ
    sessionid: sessionid //セッション
}
*/
let msgMix = function msgMix (m, userinfoRemote) {
    console.log("msgSend :: データ↓");
    console.log(m);

    let t = new Date(); //履歴に時間を追加する用
    let time = t.getFullYear() + "_" +  (t.getMonth()+1) + "_" +  t.getDate();
    let receivedTime = [t.getFullYear(), (t.getMonth()+1).toString().padStart(2,0), t.getDate().toString().padStart(2,0), t.getHours().toString().padStart(2,0), t.getMinutes().toString().padStart(2,0), t.getSeconds().toString().padStart(2,0)].join("");
    
    m.time = receivedTime;

    if ( m.content == undefined || m.content == "" ) {
        return 0;

    }

    //怪しいメッセージの検知
    if ( (m.content.indexOf("<") != -1 && m.content.indexOf("/") != -1) ) {
        console.log("msgMix :: 攻撃性のあるメッセージの検知 ↓");
        console.log(m);

        return 0;

    }

    db.msgRecord(m); //メッセージを履歴に記録

    //送信予定データ
    let M = {
        username: userinfoRemote.username, //ユーザー名
        userid: m.userid,
        channelid: m.channelid,
        time: m.time,
        content: m.content //送るメッセージ
    }

    return M;

}

exports.msgMix = msgMix;