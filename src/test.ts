import { ISync } from ".";


class PlayerSync {

    async updateRole(userId: number, info: any) {
        console.log("-----", userId, info)
    }
}



let client = new ISync({
    "handler": { "PlayerSync": new PlayerSync() },
    "syncInterval": 3000,
});

client.sync.PlayerSync.updateRole(1, { "a": 3 });



