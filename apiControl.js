const api = require("./dbControl.js");

//APIデータのテンプレ
/*
{
    userid: 12345678,
    status: "active",
    apiName: "",
    actionOnServer: {
        USER_GETINFO: false,
        SERVER_GETCONFIG: false,
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
