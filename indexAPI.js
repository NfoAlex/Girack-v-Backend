const io = require('socket.io-client');

//APIデータ関連
const apiMan = require("./apiControl.js");

//サーバー接続
const socket = io('http://localhost:33333');