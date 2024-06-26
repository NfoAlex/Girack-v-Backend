
//サーバーのホスト設定
const HOST_CONFIG = {

  /********************************************************/
  //アクセス関係


  //アクセスを許可するドメイン ( 型 : 文字[配列] string[] )
    // * 配列に含めた条件から始まるドメインを許可する
    // * 空配列にするとすべてのドメインを許可
    // * URLの最後には"/"を含めないようにしてください
  "allowedOrigin": [],

  /* 例:

  * ローカルホストのみに限定
  "allowedOrigin": [
    "http://localhost"
  ],

  * 複数の指定したドメインのみ
  "allowedOrigin": [
    "http://asdf.com",
    "https://girack.asdf"
  ],

  */

  /********************************************************/

  /********************************************************/
  //サーバーをホストするポート番号 (型 : 数字 int)
    // * 空にすると"33333"でホストする
  "port": 33333

  /********************************************************/

};

//設定情報エクスポート
exports.HOST_CONFIG = HOST_CONFIG;
