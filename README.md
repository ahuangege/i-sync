
### sync-util 
定时将数据同步到数据库。开发时享受代码提示。

### Installation

```bash
npm i sync-util
```

### Usage

```
import { SyncUtil } from "sync-util";

class PlayerSync {
    async updateCard(userId: number, cardInfo: any) {
        console.log("---updateCard--", userId, cardInfo)
    }
}

let syncUtil = new SyncUtil({
    "handler": {
        "PlayerSync": new PlayerSync()
    },
    "syncInterval": 3 * 1000
});

syncUtil.sync.PlayerSync.updateCard(1, { "cardId": 3 });
syncUtil.saveAll();
```