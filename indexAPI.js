const ioClient = require('socket.io-client');

//サーバーをホストするための環境設定を読み込む
const dataHostConfig = require("./HOST_CONFIG.js").HOST_CONFIG;
  //ポート番号
const portMain = dataHostConfig.port || 33333; //無効なら33333にする
const portApi = dataHostConfig.portApi || 22222; //無効なら22222にする

//Girackメインサーバー接続用
const GirackServer = ioClient('http://localhost:' + portMain);

//サーバーホスト用
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
//サーバーインスタンスを構成する
const app = express();
const server = http.createServer(app);
const ioServer = socketIo(server);

//接続を確認ログ出力
GirackServer.on('connect', () => {
  console.log('API :: Girackへの接続を確認しました!');
  
});

//APIサーバーとしての受け取り部分
ioServer.on("connection",(socket) => {
  console.log('API :: API用の接続を確認しました!');
});


//----------------------------------------------------------------
//APIサーバーを開く
server.listen(portApi, () => {
  console.log(` --- APIサーバーを起動しました ${portApi} --- `);

});