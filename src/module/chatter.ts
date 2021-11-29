export interface ChatterConstructorOptions {
    folderNames?: string[];
    tableSuffixes?: string[];
}

export interface ChatterConstructor {
    new (options?: ChatterConstructorOptions): Chatter;
    SOCKET_NAME: string;
}

export class Chatter {
    public static SOCKET_NAME: "module.npc-chatter";

    private folderNames: string[];
    private tableSuffixes: string[];

    constructor({
        folderNames = ["npc chatter"],
        tableSuffixes = [" chatter"],
    }: ChatterConstructorOptions = {}) {
        this.folderNames = folderNames;
        this.tableSuffixes = tableSuffixes;
    }


    public async chatter() {
        const tables: RollTable[] = [];
        
        if (canvas?.ready !== true) {
            console.warn(`Canvas not ready before chatter().`);
            return;
        }
        

        const { tokens, hud } = canvas;
        var npcTokens = canvas.tokens.controlled;

        var eligableTables = tables.filter((x) =>
            npcTokens.filter(
                (t) =>
                    x.name
                        .toLowerCase()
                        .includes(
                            t.name.toLowerCase().replace("chatter", "").trim()
                        ) > 0
            )
        );

        if (eligableTables.length == 0) return;

        var tableIndex = Math.floor(Math.random() * eligableTables.length + 0);
        var table = eligableTables[tableIndex];

        var eligableTokens = npcTokens.filter((x) =>
            x.name
                .toLowerCase()
                .includes(
                    table.name.toLowerCase().replace("chatter", "").trim()
                )
        );

        var tokenIndex = Math.floor(Math.random() * eligableTokens.length + 0);
        var token = eligableTokens[tokenIndex];

        var result = table.roll().results[0].text;
        game.socket.emit("module.npc-chatter", {
            tokenId: token.id,
            msg: result,
        });
        await canvas.hud.bubbles.say(token, result, false);
    }
    }
}

const c = new Chatter();
type X = ConstructorOf<typeof c>;

// export class Chatter implements ChatterInstance {
//     // private folderNames: string[];
//     // private tableSuffixes: string[];
//     // private chatterFolders: Folder[] = [];
//     // private relatedTables: RollTable[] = [];

//     // constructor({
//     //     folderNames = ["npc chatter"],
//     //     tableSuffixes = [" chatter"],
//     // }: { folderNames?: string[]; tableSuffixes?: string[]; } = {}) {
//     //     this.folderNames = folderNames.map(String.prototype.toLowerCase)
//     //     this.tableSuffixes = tableSuffixes.map(String.prototype.toLowerCase)
//     // }

//     // public getChatterTables() {
//     //     const tableFolders = game?.folders?.entities.filter(
//     //         (x) => x.type === "RollTable"
//     //     );

//     //     this.chatterFolders = tableFolders?.filter(x => this.folderNames?.includes(x.name.toLowerCase())

//     //     const folderIds = this.chatterFolders?.map(f => f.id);

//     //     this.relatedTables = game.tables?.entities.filter(x => {
//     //         if (folderIds?.includes(x.data.folder)) {
//     //             return true;
//     //         }
//     //     })
//     //     var chatterFolder = game.folders.entities.filter(
//     //         (x) =>
//     //             x.type == "RollTable" && x.name.toLowerCase() == "npc chatter"
//     //     )[0];
//     //     var tables = game.tables.entities.filter(
//     //         (x) =>
//     //             x.name.toLowerCase().endsWith("chatter") ||
//     //             x.data.folder == chatterFolder.id
//     //     );
//     //     return tables;
//     // }

//     // randomGlobalChatterEvery(milliseconds) {
//     //     NpcChatter.timer = window.setInterval(() => {
//     //         game.npcChatter.globalChatter();
//     //     }, milliseconds);
//     // }

//     // async globalChatter() {
//     //     var tables = this.getChatterTables();

//     //     var userCharacterActorIds = game.users.entities
//     //         .filter((x) => x.character)
//     //         .map((x) => x.character.id);
//     //     var activeScene = game.scenes.filter((x) => x.active)[0];
//     //     var npcTokens = activeScene.data.tokens.filter(
//     //         (x) => !userCharacterActorIds.includes(x.actorId)
//     //     );

//     //     var eligableTables = tables.filter((x) =>
//     //         npcTokens.filter(
//     //             (t) =>
//     //                 x.name
//     //                     .toLowerCase()
//     //                     .includes(
//     //                         t.name.toLowerCase().replace("chatter", "").trim()
//     //                     ) > 0
//     //         )
//     //     );

//     //     var tableIndex = Math.floor(Math.random() * eligableTables.length + 0);
//     //     var table = eligableTables[tableIndex];

//     //     var eligableTokens = npcTokens.filter((x) =>
//     //         x.name
//     //             .toLowerCase()
//     //             .includes(
//     //                 table.name.toLowerCase().replace("chatter", "").trim()
//     //             )
//     //     );

//     //     var tokenIndex = Math.floor(Math.random() * eligableTokens.length + 0);
//     //     var token = eligableTokens[tokenIndex];

//     //     if (token == undefined) return;

//     //     var result = table.roll().results[0].text;
//     //     game.socket.emit("module.npc-chatter", {
//     //         tokenId: token._id,
//     //         msg: result,
//     //     });
//     //     await canvas.hud.bubbles.say(token, result, false);
//     // }

//     // async tokenChatter(token) {
//     //     var tables = this.getChatterTables();

//     //     var eligableTables = tables.filter((x) =>
//     //         token.name
//     //             .toLowerCase()
//     //             .includes(x.name.toLowerCase().replace("chatter", "").trim())
//     //     );

//     //     if (eligableTables.length == 0) return;

//     //     var tableIndex = Math.floor(Math.random() * eligableTables.length + 0);
//     //     var table = eligableTables[tableIndex];

//     //     var result = table.roll().results[0].text;
//     //     game.socket.emit("module.npc-chatter", {
//     //         tokenId: token._id,
//     //         msg: result,
//     //     });
//     //     await canvas.hud.bubbles.say(token, result, false);
//     // }

//     // async selectedChatter() {
//     //     var tables = this.getChatterTables();

//     //     var npcTokens = canvas.tokens.controlled;

//     //     var eligableTables = tables.filter((x) =>
//     //         npcTokens.filter(
//     //             (t) =>
//     //                 x.name
//     //                     .toLowerCase()
//     //                     .includes(
//     //                         t.name.toLowerCase().replace("chatter", "").trim()
//     //                     ) > 0
//     //         )
//     //     );

//     //     if (eligableTables.length == 0) return;

//     //     var tableIndex = Math.floor(Math.random() * eligableTables.length + 0);
//     //     var table = eligableTables[tableIndex];

//     //     var eligableTokens = npcTokens.filter((x) =>
//     //         x.name
//     //             .toLowerCase()
//     //             .includes(
//     //                 table.name.toLowerCase().replace("chatter", "").trim()
//     //             )
//     //     );

//     //     var tokenIndex = Math.floor(Math.random() * eligableTokens.length + 0);
//     //     var token = eligableTokens[tokenIndex];

//     //     var result = table.roll().results[0].text;
//     //     game.socket.emit("module.npc-chatter", {
//     //         tokenId: token.id,
//     //         msg: result,
//     //     });
//     //     await canvas.hud.bubbles.say(token, result, false);
//     // }

//     // async turnOffGlobalTimerChatter() {
//     //     window.clearInterval(NpcChatter.timer);
//     //     NpcChatter.timer = undefined;
//     // }
// }

export default Chatter;

export interface ChatterMessage {
    [tokenId: string]: string;
}

export const readyHookId = Hooks.once("ready", async function () {
    game.Chatter = Chatter;
    game.npcChatter = new Chatter();
    console.log("Chatter");

    game.socket.on(Chatter.SOCKET_NAME, async (message: ChatterMessage) => {
        console.log(`${Chatter.SOCKET_NAME} received: ${message}`);

        if (canvas?.ready !== true) {
            console.warn(`Canvas not ready before socket message heard.`);
            return;
        }

        const { tokens, hud } = canvas;
        const chatTokens = Object.keys(message)
            .map((tokenId) => {
                const token = tokens.get(tokenId);
                if (!token) {
                    console.warn(`No token ${tokenId} found to chat.`);
                }
                return token;
            })
            .filter((x) => typeof x !== "undefined");

        chatTokens.forEach((token) => {
            // Say it!
            hud.bubbles.say(token, message[token.id], { emote: false });
        });
    });
});

// Hooks.on("chatBubble", async function (callerData, html, _text, _emote) {
//     // Fixes https://gitlab.com/foundrynet/foundryvtt/-/issues/3136
//     //html[0].setAttribute("style", "left: " + callerData.x + "px;");
// });
