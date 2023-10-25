const bcrypt = require("bcrypt"); //ハッシュ化用

export function generateFirstAdminPassword() {
    //最初のユーザー用のパスワードを生成
    const pwLength = 24; //生成したい文字列の長さ
    const pwSource = "abcdefghijklmnopqrstuvwxyz0123456789"; //元になる文字
    let pwGenResult = "";

    //生成
    for(let i=0; i<pwLength; i++){
        pwGenResult += pwSource[Math.floor(Math.random() * pwSource.length)];

    }

    //パスワードをハッシュ化
    let pwGenResultHashed = await bcrypt.hash(pwGenResult, 10);

    //初期のユーザーデータ
    let dataUserInitText = `
    {
        "user":{
            "00000001": {
                "name": "Admin",
                "role": "Admin",
                "pw": "` + pwGenResultHashed + `",
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

//別ファイルで使う用
exports.generateFirstAdminPassword = generateFirstAdminPassword;