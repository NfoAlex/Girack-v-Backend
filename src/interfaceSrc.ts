//サーバーデータ用の型定義
export interface dataServer {
    servername: string,
    "registration": {
        "available": boolean,
        "invite": {
            "inviteOnly": boolean,
            "inviteCode": string
        }
    },
    "config": {
        "PROFILE": {
            "PROFILE_ICON_MAXSIZE": string,
            "PROFILE_USERNAME_MAXLENGTH": number
        },
        "CHANNEL": {
            "CHANNEL_DEFAULT_REGISTERANNOUNCE": string,
            "CHANNEL_DEFAULT_JOINONREGISTER": string[],
            "CHANNEL_CREATE_AVAILABLE": boolean,
            "CHANNEL_DELETE_AVAILABLEFORMEMBER": boolean,
            "CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER": boolean
        },
        "MESSAGE": {
            "MESSAGE_PIN_ROLE": string,
            "MESSAGE_TXT_MAXLENGTH": string,
            "MESSAGE_FILE_MAXSIZE": string
        }
    },
    "channels": {
        [key:string]: {
            name: string,
            description: string,
            pins: any[],
            scope: string,
            canTalk: string
        }
    }
};

//チャンネル格納用
export interface channel {
    [key:string]: {
        name: string,
        description: string,
        pins: any[],
        scope: string,
        canTalk: string
    }
};

//チャンネル単体用
export interface channelSingle {
    channelid: string,
    channelname: string,
    description: string,
    pins: string[],
    scope: string,
    canTalk: string
};

//ユーザーデータの型定義
export interface dataUser {
    user: {
        [key: string]: {
            name: string,
            role: string,
            pw: string,
            state: {
                loggedin: boolean,
                sessions: {
                    [key:string]: {
                        sessionName: string,
                        loggedinTime: string,
                        loggedinTimeFirst: string
                    }
                },
                banned: boolean
            },
            channel: string[]
        }
    }
};

//ユーザー単体用
export interface userSingle {
    username: string,
    userid: string,
    role: string,
    banned: boolean,
    loggedin: boolean,
    channelJoined: string[]
};

//リクエストの送信者
export interface reqSender {
    userid: string,
    sessionid: string
};