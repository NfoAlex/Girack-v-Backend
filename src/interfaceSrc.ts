//サーバーデータ用の型定義
export interface dataServer {
    servername: string,
    registration: {
        available: boolean,
        invite: {
            inviteOnly: boolean,
            inviteCode: string
        }
    },
    config: {
        PROFILE: {
            PROFILE_ICON_MAXSIZE: number,
            PROFILE_USERNAME_MAXLENGTH: number
        },
        CHANNEL: {
            CHANNEL_DEFAULT_REGISTERANNOUNCE: string,
            CHANNEL_DEFAULT_JOINONREGISTER: string[],
            CHANNEL_CREATE_AVAILABLE: boolean,
            CHANNEL_DELETE_AVAILABLEFORMEMBER: boolean,
            CHANNEL_PRIVATIZE_AVAILABLEFORMEMBER: boolean
        },
        MESSAGE: {
            MESSAGE_PIN_ROLE: string,
            MESSAGE_TXT_MAXLENGTH: number,
            MESSAGE_FILE_MAXSIZE: number
        }
    },
    channels: {
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

//ユーザーの個人データ(設定とか既読状態とか)
export interface dataUserSave {
    configAvailable: boolean,
    config: any, //暫定
    msgReadStateAvailable: boolean,
    msgReadState: any, //暫定
    channelOrder: string[]
}

//処理前のメッセージ用
export interface message {
    userid: string | null,
    channelid: string,
    content: string,
    replyData: {
        isReplying: boolean,
        userid: string,
        messageid: string
    },
    fileData: {
        isAttatched: boolean,
        attatchmentData: [{
            name: string,
            size: number,
            type: string,
            fileid: string,
            buffer: any|null //履歴として書き込む際は削除される
        }] | null
    },
    hasUrl: boolean,
    urlData: {
        dataLoaded: boolean,
        data: [{
            url: string,
            mediaType: string,
            title: string,
            description: string,
            img: string[],
            video: string[],
            favicon: string | null
        }] | null
    },
    isSystemMessage: boolean | null
};

//処理されたメッセージ用
export interface messageRead {
    messageid: any
    userid: string,
    channelid: string,
    time: string,
    pinned: boolean,
    content: string,
    replyData: {
        isReplying: boolean,
        userid: string,
        messageid: string
    },
    fileData: {
        isAttatched: boolean,
        attatchmentData: [{
            name: string,
            size: number,
            type: string,
            fileid: string,
            buffer: any|null //履歴として書き込む際は削除される
        }] | null
    },
    hasUrl: boolean,
    urlData: {
        dataLoaded: boolean,
        data: [{
            url: string,
            mediaType: string,
            title: string,
            description: string,
            img: string[],
            video: string[],
            favicon: string | null
        }] | null
    },
    isSystemMessage: boolean | null,
    reaction: {
        [key:string]: number
    }
}

//リクエストの送信者
export interface reqSender {
    userid: string,
    sessionid: string
};