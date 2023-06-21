//メッセージ関連

const fs = require('fs'); //履歴書き込んだり読み込むために
const db = require("./dbControl.js"); //データベース関連
const { getLinkPreview } = require("link-preview-js");
const indexjs = require("./index.js");
const infoUpdate = require("./infoUpdate.js");

//URLプレビュー時のリダイレクト用URLのブロック対象にならないリスト
const knownRedirectUrls = [
    "discord.gg",
    "youtu.be",
];

//URLプレビュー時に強制的にリダイレクト用URLのブロック対象になるリスト
const blackRedirectUrls = [

];

//URL検知用
let urlRegex = /((https|http)?:\/\/[^\s]+)/g;

//メッセージを処理して送れる形にする
let msgMix = function msgMix(m) {
    /*
    m
    {
        userid: Userinfo.value.userid, //名前
        channelid: this.getPath, //チャンネルID
        sessionid: Userinfo.value.sessionid, //セッションID);
        content: this.txt //メッセージの本文
    }
    */
    console.log("msgSend :: データ↓");
    console.log(m);

    let t = new Date(); //履歴に時間を追加する用
    let receivedTime = [t.getFullYear(), (t.getMonth()+1).toString().padStart(2,0), t.getDate().toString().padStart(2,0), t.getHours().toString().padStart(2,0), t.getMinutes().toString().padStart(2,0), t.getSeconds().toString().padStart(2,0)].join("");
    //let messageid = [receivedTime, t.getMilliseconds().toString().padStart(6,0) ].join("");

    m.time = receivedTime; //送信時間を受信メッセージに追加

    //メッセージがそもそも有効なものかどうか
    if (
        m.content === undefined ||
        m.content.length > db.dataServer.config.MESSAGE.MESSAGE_TXT_MAXLENGTH || //長さがサーバー規定を超えてるなら
        ( m.content.includes("<img") && m.content.includes("onerror") ) || //XSS避け
        ( m.content.length === 0 && !m.fileData.isAttatched ) || //長さが0だったら
        ( m.content.replace(/　/g,"").length === 0 && !m.fileData.isAttatched ) || //添付ファイルがなく、空白だけのメッセージだった時用
        ( m.content.replace(/ /g,"").length === 0 && !m.fileData.isAttatched ) //添付ファイルがなく、半角も同様
    ) {
        return -1; //エラーとして返す

    }

    //もしメッセージにURLが含まれるのであれば
    if ( (urlRegex).test(m.content) ) {
        //URL取り出し
        let urlInText = (m.content).match(urlRegex);

        //メッセージデータに新しく追加
        m.hasUrl = true;
        m.urlData = {
            dataLoaded: false,
            data: [
                // {
                //     link: "https://example.com/?q=asdf&id=asdf4321",
                //     title: "...",
                //     description: "...",
                //     domain: "https://example.com",
                //     img: "...",
                //     favicon: "...",
                // }
            ]
        };

        //URLを追加
        for ( let index in urlInText ) {
            //URLデータの部分へデータ追加
            m.urlData.data.push({
                url: urlInText[index],
                title: "",
                description: "...",
                domain: "https://example.com",
                img: [],
                favicon: "...",
            });

        }

    } else {
        //メッセージデータに新しく追加
        m.hasUrl = false;
        m.urlData = {
            dataLoaded: false,
            data: [
                {
                    title: null,
                    description: null,
                    domain: null,
                    img: [],
                    favicon: null
                }
            ]
        };

    }

    //ファイルが添付されているなら
    if ( m.fileData.isAttatched ) {
        console.log("ファイル処理作業始めるわ");
        //添付ファイルへID振り分け
        // for ( let index in m.fileData.attatchmentData ) {
        //     //IDは日付+チャンネルID+ユーザーID+乱数8桁
        //     m.fileData.attatchmentData[index].fileid = m.channelid + m.userid + parseInt(Math.random()*99999999);

        // }
        let receivedDatePath = t.getFullYear() + "_" + (t.getMonth()+1).toString().padStart(2,0) + "_" +  t.getDate().toString().padStart(2,0);
        writeUploadedFile(m.fileData, m.channelid, receivedDatePath); //ファイル処理開始

        //履歴へ書き込む際は不要なためファイルデータそのものを削除
        for ( let index in m.fileData.attatchmentData ) {
            delete m.fileData.attatchmentData[index].buffer;

        }

    }

    //返信をしているなら
    try {
        //データに返信先の文章を追加
        if ( m.replyData.isReplying ) {
            let msg = getMessage(m.channelid, m.replyData.messageid);
            m.replyData.content = msg.content;
            m.replyData.userid = msg.userid;

        }
    } catch(e) {
        console.log("Message :: msgMix : こいつ返信データがない");
    }

    msgRecord(m); //メッセージをDBに記録

    let MessageCompiled = getLatestMessage(m.channelid); //DBからメッセージ取得して送信

    return MessageCompiled;

}

//ファイルが添付されているならいろいろ処理する部分
let writeUploadedFile = function uploadFile(fileData, channelid, receivedDatePath) {
    //ファイル用ディレクトリを作成
    try{fs.mkdirSync("./files/"+channelid);}catch(e){console.log("なんか怒ってるな1", e);}
    try{fs.mkdirSync("./files/"+channelid+"/"+receivedDatePath);}catch(e){console.log("なんか怒ってるな2", e);}

    //ファイルの書き込み(複数の書き込み用にfor)
    for ( let index in fileData.attatchmentData ) {
        //ファイルサイズが大きかったら書き込まない
        if ( fileData.attatchmentData[index].size >= db.dataServer.config.MESSAGE.MESSAGE_FILE_MAXSIZE ) {
            console.log("このファイルのサイズが大きい");
        
        } else {
            try {
                //ファイルを書き込み
                fs.writeFile("./files/"+channelid+"/"+receivedDatePath+"/"+fileData.attatchmentData[index].name, fileData.attatchmentData[index].buffer, (err) => {
                    console.log("Message :: uploadFile : アップロード結果 -> ", err);

                });
            } catch(e) {
                console.log("Message :: uploadFIle : ファイル書き込みできなかった?");
            }
            
        }

    }

}

//メッセージ履歴にデータ追加
let addUrlPreview = async function addUrlPreview(url, channelid, msgId, urlIndex) {
    let fulldate = msgId.slice(0,4) + "_" + msgId.slice(4,6) + "_" + msgId.slice(6,8);

    let pathOfJson = "./record/" + channelid + "/" + fulldate + ".json";
    let dataHistory = {};

    console.log("Message :: addUrlPreview : これからプレビュー生成");

    //URLプレビュー用JSON変数
    let previewData = {};
    //URlプレビューがエラーだったかどうか
    let errorPreviewing = false;

    //URLプレビュー取得
    try {
        await getLinkPreview(url, {
            //ここからURLのリダイレクト処理(https://www.npmjs.com/package/link-preview-js)
            followRedirects: `manual`,
            handleRedirects: (baseURL, forwardedURL) => {
                const urlObj = new URL(baseURL);
                const forwardedURLObj = new URL(forwardedURL);
                
                //URLを元にプレビュー取得をブロックするかどうかを調べる
                if (
                    knownRedirectUrls.includes(urlObj.hostname) ||
                    !blackRedirectUrls.includes(urlObj.hostname) ||
                    forwardedURLObj.hostname === urlObj.hostname ||
                    forwardedURLObj.hostname === "www." + urlObj.hostname ||
                    "www." + forwardedURLObj.hostname === urlObj.hostname
                ) {
                    return true; //URLを読み込む

                } else {
                    return false; //URLを読み込まない

                }

            }

        }).then((data) =>
            previewData = data //取得できたらデータを変数へ設定

        );
    }
    catch(e) { //プレビューブロックされた用
        console.log("Message :: addUrlPreview : エラー!");
        console.log(e);
        console.log("\n");

        //エラーがあったと設定
        errorPreviewing = true;

        return -1; //関数を終わらせる
    }

    console.log("Message :: addUrlPreview : 生成した↓");
    console.log(previewData);

    /*

         プレビューの前に履歴を読み込むと複数のURLを処理する際に
        プレビュー処理(async)が挟まり更新のタイミングが必ずずれて片方しか更新されないため
        ここで読んでズレを最小限にする。

        解説)
        履歴={1:null, 2:null}
        URL1 => 履歴読み込み => プレビュー開始(n秒) => 履歴上書き、書き込み(➊)
        URl2 => 履歴読み込み => プレビュー開始(n秒)                            => 履歴上書き、書き込み(➋)

        ➊の時点の履歴={1:"asdf", 2:null}
        ➋の時点の履歴={1:null, 2:"fdsa"}

        最終履歴={1:null, 2:"fdsa"}

    */
    try {
        //メッセージデータが入る履歴JSONを読み込み
        dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8'));
    }
    catch(e) {
        return -1;
    }

    //もしプレビューがとれなかったのなら
    if ( errorPreviewing ) {
        //URLをなかったことにしてフロントで読み込ませない
        dataHistory[msgId].hasUrl = false;

        //書き込み
        fs.writeFileSync(pathOfJson, JSON.stringify(dataHistory, null, 4));
        return -1; //関数を終わらせる

    }

    //データ更新
    switch( previewData.mediaType ) {
        case "website":
            dataHistory[msgId].urlData.data[urlIndex] = {
                url: url,
                mediaType: previewData.mediaType,
                title: previewData.title,
                description: previewData.description,
                img: previewData.images,
                favicon: previewData.favicons[0]
            };
            break;

        case "article":
            dataHistory[msgId].urlData.data[urlIndex] = {
                url: url,
                mediaType: previewData.mediaType,
                title: previewData.title,
                description: previewData.description,
                img: previewData.images,
                favicon: previewData.favicons[0]
            };
            break;

        case "image":
            dataHistory[msgId].urlData.data[urlIndex] = {
                url: url,
                mediaType: previewData.mediaType,
                title: previewData.title,
                description: previewData.description,
                img: url,
            };
            break;

        default:
            try {
                dataHistory[msgId].urlData.data[urlIndex] = {
                    url: url,
                    mediaType: "article",
                    title: previewData.title,
                    description: previewData.description,
                    img: previewData.images,
                    favicon: previewData.favicons[0]
                };
            }
            catch(e) {
                dataHistory[msgId].urlData.data[urlIndex] = {
                    url: url,
                    mediaType: "website",
                    title: "",
                    description: "",
                    img: null,
                    favicon: null
                };
            }
            break;

    }

    console.log("Message :: addUrlPreview : これから書き込むメッセージデータのURL部分");
    console.log(dataHistory[msgId].urlData.data);

    //書き込み
    fs.writeFileSync(pathOfJson, JSON.stringify(dataHistory, null, 4));

    indexjs.sendUrlPreview(dataHistory[msgId].urlData.data[urlIndex], channelid, msgId, urlIndex);

}

//指定したチャンネルの最新メッセージを返す(contentではない)
let getLatestMessage = function latestMessage(channelid) {
    let t = new Date(); //履歴に時間を追加する用
    let fulldate = t.getFullYear() + "_" +  (t.getMonth()+1).toString().padStart(2,0) + "_" +  t.getDate().toString().padStart(2,0);

    //let receivedTime = [time, t.getMilliseconds() ].join("");

    //メッセージを送るチャンネルの履歴データのディレクトリ
    let pathOfJson = "./record/" + channelid + "/" + fulldate + ".json";
    let dataHistory = {}; //メッセージデータのJSON読み込み

    try {
        dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8'));
    }
    catch(e) {
        console.log("getLatestMessage :: ERROR");
        throw e;
    }
    
    return Object.entries(dataHistory)[Object.entries(dataHistory).length-1][1];

}

//メッセージを単体で取得
let getMessage = function getMessage(channelid, messageid) {
    //メッセージIDから送信日付を取得
    let fulldate = messageid.slice(0,4) + "_" + messageid.slice(4,6) + "_" + messageid.slice(6,8);
    let pathOfJson = "./record/" + channelid + "/" + fulldate + ".json";
    console.log("Message :: getMessage : pathOfJson", pathOfJson);

    //データ取り出し
    try{
        dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8')); //メッセージデータのJSON読み込み
        
        //もしデータが正常にとれるならそれを返す
        if ( dataHistory[messageid] !== undefined ) {
            return dataHistory[messageid];

        } else { //undefinedなら削除された体で返す
            return {
                "messageid": messageid,
                "userid": "xxxxxxxxx",
                "channelid": channelid,
                "time": "20010101000000",
                "content": "消去されたメッセージ",
                "replyData": {
                    "isReplying": false,
                    "messageid": null
                },
                "fileData": {
                    "isAttatched": false,
                    "attatchmentData": []
                },
                "hasUrl": false,
                "urlData": {
                    "dataLoaded": false,
                    "data": [
                        {
                            "title": null,
                            "description": null,
                            "domain": null,
                            "img": [],
                            "favicon": null
                        }
                    ]
                },
                "reaction": {}
            };

        }
    }
    catch(e) { //エラーなら中止
        return {
            "messageid": messageid,
            "userid": "xxxxxxxxx",
            "channelid": channelid,
            "time": "20010101000000",
            "content": "消去されたメッセージ",
            "replyData": {
                "isReplying": false,
                "messageid": null
            },
            "fileData": {
                "isAttatched": false,
                "attatchmentData": []
            },
            "hasUrl": false,
            "urlData": {
                "dataLoaded": false,
                "data": [
                    {
                        "title": null,
                        "description": null,
                        "domain": null,
                        "img": [],
                        "favicon": null
                    }
                ]
            },
            "reaction": {}
        };
    }

    

}

//メッセージの削除
let msgDelete = function msgDelete(dat) {
    /*
    dat
    {
        action: "delete",
        channelid: channelid,
        messageid: msgId,
        reqSender: {
            userid: userinfo.userid,
            sessionid: userinfo.sessionid
        }
    }
    */
    console.log("Message :: msgDelete : これから削除");
    console.log(dat);

    let t = new Date(); //履歴に時間を追加する用

    //メッセージIDから送信日付を取得
    let fulldate = dat.messageid.slice(0,4) + "_" + dat.messageid.slice(4,6) + "_" + dat.messageid.slice(6,8);
    
    //メッセージを送るチャンネルの履歴データのディレクトリ
    let pathOfJson = "./record/" + dat.channelid + "/" + fulldate + ".json";
    let dataHistory = {};
    //console.log("Message :: msgDelete : 消そうとしているjson -> " + pathOfJson);

    //データ取り出し
    try{
        dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8')); //メッセージデータのJSON読み込み
        dataHistory[dat.messageid].content;
    }
    catch(e) { //エラーなら中止
        return -1;
    }

    //もし添付ファイルがあればファイルを削除
    if ( dataHistory[dat.messageid].fileData.isAttatched ) {
        let fileDatas = []; //ファイルデータ取り込み
        let fileidPathName = ""; //欲しいファイルインデックスのパス
        let fileidIndex = {}; //ファイルインデックスのデータ

        //削除処理開始
        try {
            fileDatas = dataHistory[dat.messageid].fileData.attatchmentData;
            console.log("Messages :: msgDelete : fileid->",dataHistory[dat.messageid].fileData.attatchmentData);
            //ファイルIDからJSON名を取得(日付は複数ファイルでも同じになるはずなのでとりあえず最初を参照)
            fileidPathName = fileDatas[0].fileid.slice(0,4) + "_" + fileDatas[0].fileid.slice(4,6) + "_" + fileDatas[0].fileid.slice(6,8);
            //ファイルインデックスを取得
            fileidIndex = JSON.parse(fs.readFileSync('./fileidIndex/' + dat.channelid + '/' + fileidPathName + '.json', 'utf-8')); //ユーザーデータのJSON読み込み

            //ファイルの数だけ処理
            for ( let index in fileDatas ) {
                //ファイル削除
                fs.unlink(__dirname + "/files/" + dat.channelid + "/" + fileidPathName + "/" + fileidIndex[fileDatas[index].fileid].name, (err) => {
                    //エラー用
                    if ( err ) console.log(err);

                });
                //ファイルインデックスJSONからIDを削除
                delete fileidIndex[fileDatas[index].fileid];

            }

            //ファイルインデックスを書き込み
            fs.writeFileSync('./fileidIndex/' + dat.channelid + '/' + fileidPathName + '.json', JSON.stringify(fileidIndex, null, 4));
        } catch(e) {
            console.log("Message :: msgDelete : ファイル削除失敗", e);
        }

    }

    //送信者と削除する人が同じじゃなければ監査ログへ書き込む
    if ( dat.reqSender.userid !== dataHistory[dat.messageid].userid ) {
        //記録処理
        infoUpdate.recordModeration(
            dat.reqSender.userid,
            {
                type: "message",
                userid: dataHistory[dat.messageid].userid,
                channelid: dataHistory[dat.messageid].channelid,
                messageid: dat.messageid
            },
            {
                actionname: "messageDelete",
                valueBefore: "",
                valueAfter: ""
            }
        );

    }

    //削除!
    delete dataHistory[dat.messageid];

    //書き込み
    fs.writeFileSync(pathOfJson, JSON.stringify(dataHistory, null, 4));

    //返す結果用に履歴を取得
    //let result = msgRecordCall(dat.channelid, 10);
    let result = {
        action: "delete",
        channelid: dat.channelid,
        messageid: dat.messageid,
    };

    return result; //返す

}

//メッセージにリアクションする
let msgReaction = function msgReaction(dat) {
    /*
    dat
    {
        action: "reaction",
        channelid: dat.channelid,
        messageid: dat.msgId,
        reaction: dat.emote
        reqSender: {
            userid: userinfo.userid,
            sessionid: userinfo.sessionid
        }
    }
    */

    console.log("Message :: msgReaction : これからリアクション");
    console.log(dat);

    let t = new Date(); //履歴に時間を追加する用
    //let fulldate = t.getFullYear() + "_" +  (t.getMonth()+1).toString().padStart(2,0) + "_" +  t.getDate().toString().padStart(2,0);
    //メッセージIDから送信日付を取得
    let fulldate = dat.messageid.slice(0,4) + "_" + dat.messageid.slice(4,6) + "_" + dat.messageid.slice(6,8);
    
    //メッセージを送るチャンネルの履歴データのディレクトリ
    let pathOfJson = "./record/" + dat.channelid + "/" + fulldate + ".json";
    let dataHistory = {};

    //データ取り出し
    try{
        dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8')); //メッセージデータのJSON読み込み
        dataHistory[dat.messageid].content;
    }
    catch(e) {
        return -1;
    }

    let reactionNow = 0; //つけようとしているリアクションの今の数

    //リアクションの数を取得、そもそもなければスルー
    if ( dataHistory[dat.messageid].reaction[dat.reaction] !== undefined ) {
        reactionNow = dataHistory[dat.messageid].reaction[dat.reaction];

    }

    //リアクションを加算
    dataHistory[dat.messageid].reaction[dat.reaction] = reactionNow + 1;

    let result = {
        action: "reaction",
        channelid: dat.channelid,
        messageid: dat.messageid,
        reaction: dataHistory[dat.messageid].reaction
    };

    console.log("Message :: リアクションされた");
    console.log(dataHistory[dat.messageid].reaction);

    //書き込み
    fs.writeFileSync(pathOfJson, JSON.stringify(dataHistory, null, 4));

    return result;

}

//メッセージの履歴を保存
let msgRecord = function msgRecord(json) {
    let t = new Date(); //履歴に時間を追加する用
    let fulldate = t.getFullYear() + "_" +  (t.getMonth()+1).toString().padStart(2,0) + "_" +  t.getDate().toString().padStart(2,0);
    let receivedTime = [json.time, t.getMilliseconds().toString().padStart(6,0) ].join("");

    //メッセージを送るチャンネルの履歴データのディレクトリ
    let pathOfJson = "./record/" + json.channelid + "/" + fulldate + ".json";
    let pathOfJsonFileIndex = "./fileidIndex/" + json.channelid + "/" + fulldate + ".json";
    
    //JSONファイルを開いてみて、いけたらそのまま読み込み、なかったら作る
    try { //JSONの存在確認
        //ファイルを読み込んでみる(使いはしない、存在を確認するだけ)
        fs.statSync(pathOfJson);

    } catch(err) { //存在無しなら(読み込みエラーなら)
        //そのチャンネルのディレクトリ作成もトライ(過去に作ってたならスルー)
        try{fs.mkdirSync("./record/" + json.channelid);}catch(e){/* ここにくるなら存在するから過去に作っていたということ */}
        fs.writeFileSync(pathOfJson, "{}"); //DBをJSONで保存

    }
    //ファイルID用JSONにも同じく
    try { //JSONの存在確認
        //ファイルを読み込んでみる(使いはしない、存在を確認するだけ)
        fs.statSync(pathOfJsonFileIndex);

    } catch(err) { //存在無しなら(読み込みエラーなら)
        //そのチャンネルのファイルＩＤ用ディレクトリ作成もトライ(過去に作ってたならスルー)
        try{fs.mkdirSync("./fileidIndex/" + json.channelid);}catch(e){/* ここにくるなら存在するから過去に作っていたということ */}
        fs.writeFileSync(pathOfJsonFileIndex, "{}"); //空のJSONを保存

    }

    //メッセージデータのJSON読み込み
    let dataHistory = JSON.parse(fs.readFileSync(pathOfJson, 'utf-8'));
    //ファイルIDインデックスJSON読み込み
    let fileidIndex = JSON.parse(fs.readFileSync(pathOfJsonFileIndex, 'utf-8'));
    let latestMessage = []; //履歴の最後

    //ファイル添付があればファイルIDインデックスへファイル情報を記録してファイル情報を削除(typeとファイルIDがあるはず)
    if ( json.fileData.isAttatched ) {
        //ファイルIDの振り分け
        for ( let index in json.fileData.attatchmentData ) {
            //IDは日付+ユーザーID+乱数8桁
            json.fileData.attatchmentData[index].fileid = json.time + json.userid + parseInt(Math.random()*99999999);
        
        }
        
        //ファイルIDへファイル情報を追記
        for ( let index in json.fileData.attatchmentData ) {
            try {
                fileidIndex[json.fileData.attatchmentData[index].fileid] = {
                    name: json.fileData.attatchmentData[index].name,
                    userid: json.userid,
                    size: json.fileData.attatchmentData[index].size,
                    type: json.fileData.attatchmentData[index].type,
                };
                //delete json.fileData.attatchmentData[index].name;
                //delete json.fileData.attatchmentData[index].size;
            } catch(e) {
                console.log("Message :: msgRecord : ファイルID記録に失敗");
            }

        }

    }

    //履歴書き込み開始
    try {
        //DBに追加
        dataHistory[[receivedTime,json.messageid].join("")] = { //JSONでの順番はキーでソートされるから時間を最初に挿入している
            //type: json.type,
            messageid: [receivedTime,json.messageid].join(""), //メッセージID
            userid: json.userid,
            channelid: json.channelid,
            time: json.time,
            content: json.content,
            replyData: json.replyData,
            fileData: json.fileData,
            hasUrl: json.hasUrl,
            urlData: json.urlData,
            reaction: {}
        };

    }
    catch(e) {
        return -1;

    }

    //JSON書き込み保存
    //console.log("msgRecord :: 4");
    //fs.writeFileSync(pathOfJson, JSON.stringify(dataHistorySorted, null, 4));
    fs.writeFileSync(pathOfJson, JSON.stringify(dataHistory, null, 4));
    fs.writeFileSync(pathOfJsonFileIndex, JSON.stringify(fileidIndex, null, 4));

    //console.log("msgRecord :: jsonファイルが -> " + isExist + " , " + dataHistory);

}

//メッセージ履歴を最新から順に範囲分返す
let msgRecordCallNew = async function msgRecordCall(cid, readLength, startLength) { //cid=>チャンネルID, readLength=>ほしい履歴の範囲, startLength=>ほしい履歴の範囲の始まり位置
    //履歴JSONへのパス
    let dirOfJson = "./record/" + cid;
    let readCount = 0;

    //startLengthが空なら最初から読むように
    if ( startLength === undefined ) { startLength = 0; }

    try {
        //JSONのディレクトリ取得
        ListOfJson = await new Promise((resolve) => { //取得が完了するまで処理を待つ
            //読み込み
            fs.readdir(dirOfJson, (err, files) => {
                ListOfJson = files; //ファイルの名前取得
                resolve(); //処理を終了、次の処理へ

            });

        }).then(() => {
            //追加された順だと古い順なので
            return ListOfJson.reverse();

        });
    }
    catch(e) {
        return -1;
    }

    //履歴用配列
    let dat = [];

    //履歴の読み込み開始
    for ( let index in ListOfJson ) {
        //データ読み込み
        let dataHistory = JSON.parse(fs.readFileSync("./record/" + cid + "/" + ListOfJson[index], 'utf-8'));
        let jsonLength = Object.entries(dataHistory).length;

        //ループで履歴を追加
        for ( let i=1; i<=jsonLength; i++ ) {
            //もし読み込んだ回数がスタート位置以上なら
            if ( readCount >= startLength ) { //比較、最初からならstartLengthは0
                //履歴を配列へ追加
                dat.push(
                    Object.entries(dataHistory)[Object.entries(dataHistory).length-i][1]
                );

                readLength--; //読み取る履歴の数を減算

            }

            readCount++;

            //途中で読み取る履歴の数を満たしたら
            if ( readLength <= 0 ) {
                return dat.reverse(); //追加された順だと古い順なので

            }

        }

    }

    return dat.reverse(); //追加された順だと古い順なので

}

exports.msgMix = msgMix; //メッセージ送受信
exports.addUrlPreview = addUrlPreview; //URLプレビュー設定
exports.msgRecord = msgRecord; //履歴に記録
exports.msgRecordCallNew = msgRecordCallNew; //履歴呼び出し(新しいほう)
exports.msgDelete = msgDelete; //メッセージ削除
exports.msgReaction = msgReaction; //メッセージにリアクションする