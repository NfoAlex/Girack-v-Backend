const apiMan = require("./dbControl.js");
const db = require("./dbControl.js");

//APIデータのテンプレ
/*
{
    userid: 12345678,
    type: "user"|"bot",
    status: "active"|"pending"|"disabled",
    apiName: "",
    actionOnServer: {
        USER_GETINFO: false,
        CHANNEL_GETINFO: true,
        CHANNEL_GETLIST: false
    },
    actionPerChannel: {
        "0001": {
            MESSAGE_TALK: false,
            MESSAHE_READ: true
        },
        "1234": {
            MESSAGE_TALK: true,
            MESSAGE_READ: true
        }
    }
}
*/
